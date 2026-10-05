import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import AuthPage from './components/AuthPage'
import { supabase } from './lib/supabaseClient'
import { speakText, stopSpeaking } from './utils/speech'
import { apiUrl } from './lib/api'

// Production error sanitization helper
function sanitizeErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  const msg = typeof err === 'string' ? err : err.message || ''
  if (!msg) return fallback

  const lower = msg.toLowerCase()
  if (lower.includes('unauthorized') || lower.includes('session has expired') || lower.includes('jwt')) {
    return 'Your session has expired. Please login again.'
  }
  if (lower.includes('rate limit') || lower.includes('quota') || lower.includes('429')) {
    return 'AI generation limit reached. Please wait a moment before sending another message.'
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('unavailable') || lower.includes('503')) {
    return 'AI service is temporarily unavailable. Please try again.'
  }
  if (lower.includes('web search')) {
    return 'Web search is temporarily unavailable.'
  }
  if (lower.includes('too large') || lower.includes('maximum size')) {
    return msg
  }
  if (lower.includes('invalid file type') || lower.includes('only pdf') || lower.includes('only jpg')) {
    return msg
  }
  if (msg.includes('http') || msg.includes('{') || msg.includes('SQL') || msg.includes('column')) {
    return fallback
  }
  return msg
}

export default function App() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Step 6 & 7: Attachment states (PDF & Image)
  const [activeFile, setActiveFile] = useState(null)
  const [activeImage, setActiveImage] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgressText, setUploadProgressText] = useState('')
  const [uploadError, setUploadError] = useState(null)
  const [uploadSuccess, setUploadSuccess] = useState(null)

  // Step 9: Voice & Web Search states
  const [speakingMessageId, setSpeakingMessageId] = useState(null)
  const [voiceRate, setVoiceRate] = useState(1.0)
  const [voiceLang, setVoiceLang] = useState('en-US')
  const [isWebSearch, setIsWebSearch] = useState(false)

  // Auth Header helper for API requests
  const getAuthHeaders = useCallback(async () => {
    const headers = { 'Content-Type': 'application/json' }
    if (supabase) {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session?.access_token) {
          headers.Authorization = `Bearer ${data.session.access_token}`
          return headers
        }
      } catch (err) {
        console.warn('Failed to retrieve active supabase session token:', err)
      }
    }
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    } else if (user?.id) {
      headers.Authorization = `Bearer ${user.id}`
      headers['x-user-id'] = user.id
    }
    return headers
  }, [session, user])

  // Format ISO timestamp into human-readable HH:MM AM/PM
  const formatTime = (isoString) => {
    if (!isoString) {
      return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Check auth session on mount and subscribe to changes
  useEffect(() => {
    async function checkSession() {
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession()
          if (data?.session) {
            setSession(data.session)
            setUser(data.session.user)
          } else {
            // Check local fallback storage
            const saved = localStorage.getItem('bujju_user')
            if (saved) {
              setUser(JSON.parse(saved))
            }
          }
        } else {
          // Fallback when Supabase is not configured
          const saved = localStorage.getItem('bujju_user')
          if (saved) {
            setUser(JSON.parse(saved))
          }
        }
      } catch (err) {
        console.error('Session check error:', err)
      } finally {
        setIsAuthLoading(false)
      }
    }

    checkSession()

    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user || null)
        if (!currentSession) {
          localStorage.removeItem('bujju_user')
          localStorage.removeItem('bujju_active_chat_id')
          setConversations([])
          setMessages([])
          setActiveChatId(null)
          setActiveFile(null)
          setUploadError(null)
          setUploadSuccess(null)
        }
      })

      return () => {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  // Load conversation messages by ID
  const loadConversationMessages = useCallback(
    async (convId) => {
      if (!convId || !user) return
      setIsChatLoading(true)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(apiUrl(`/api/conversations/${convId}`), {
          headers,
        })
        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        const data = await res.json()
        const formatted = (data.messages || []).map((m) => ({
          id: m.id,
          sender: m.role === 'assistant' ? 'ai' : m.role,
          text: m.content,
          timestamp: formatTime(m.created_at),
        }))
        setMessages(formatted)

        // Restore file reference if conversation has one attached
        if (data.conversation?.file_id && data.conversation?.file_name) {
          setActiveFile({
            id: data.conversation.file_id,
            filename: data.conversation.file_name,
          })
        } else {
          setActiveFile(null)
        }

        setActiveImage((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
          return null
        })
      } catch (err) {
        console.error('Failed to load conversation history:', err)
        setMessages([])
        setActiveFile(null)
        setActiveImage((prev) => {
          if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
          return null
        })
      } finally {
        setIsChatLoading(false)
      }
    },
    [user, getAuthHeaders],
  )

  // Step 9: Speech Synthesis (TTS) handlers
  const handleStopSpeaking = useCallback(() => {
    stopSpeaking()
    setSpeakingMessageId(null)
  }, [])

  const handleToggleSpeak = useCallback(
    (message) => {
      if (!message || !message.text) return
      if (speakingMessageId === message.id) {
        handleStopSpeaking()
      } else {
        handleStopSpeaking()
        setSpeakingMessageId(message.id)
        speakText(message.text, {
          rate: voiceRate,
          lang: voiceLang,
          onStart: () => setSpeakingMessageId(message.id),
          onEnd: () => setSpeakingMessageId(null),
          onError: () => setSpeakingMessageId(null),
        })
      }
    },
    [speakingMessageId, voiceRate, voiceLang, handleStopSpeaking],
  )

  // Create a brand new conversation for the user
  const handleNewChat = useCallback(async () => {
    if (!user) return

    handleStopSpeaking()
    setActiveFile(null)
    setActiveImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setUploadError(null)
    setUploadSuccess(null)

    try {
      const headers = await getAuthHeaders()
      const res = await fetch(apiUrl('/api/conversations'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'New Chat' }),
      })

      if (res.ok) {
        const newConv = await res.json()
        setConversations((prev) => [newConv, ...prev])
        setActiveChatId(newConv.id)
        setMessages([])
        localStorage.setItem(`bujju_active_chat_${user.id}`, newConv.id)
      }
    } catch (err) {
      console.error('Error creating new conversation:', err)
    }
    setIsSidebarOpen(false)
  }, [user, getAuthHeaders, handleStopSpeaking])

  // Fetch conversations whenever user logs in or switches
  useEffect(() => {
    if (!user) return

    let isMounted = true

    async function fetchUserConversations() {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(apiUrl('/api/conversations'), {
          headers,
        })
        if (!res.ok) throw new Error(`HTTP error ${res.status}`)
        const list = await res.json()

        if (!isMounted) return

        const validList = Array.isArray(list) ? list : []
        setConversations(validList)

        if (validList.length > 0) {
          const savedActiveId = localStorage.getItem(`bujju_active_chat_${user.id}`)
          const found = validList.find((c) => c.id === savedActiveId)
          const targetId = found ? found.id : validList[0].id

          setActiveChatId(targetId)
          localStorage.setItem(`bujju_active_chat_${user.id}`, targetId)
          await loadConversationMessages(targetId)
        } else {
          setActiveChatId(null)
          setMessages([])
          setActiveFile(null)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to fetch user conversations:', err)
        setConversations([])
        setActiveChatId(null)
        setMessages([])
        setActiveFile(null)
      }
    }

    fetchUserConversations()

    return () => {
      isMounted = false
    }
  }, [user, getAuthHeaders, loadConversationMessages])

  // Keyboard shortcut: Ctrl+K or Cmd+K to start a new chat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleNewChat()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewChat])

  // Switch to another conversation
  const handleSelectChat = async (id) => {
    handleStopSpeaking()
    if (id === activeChatId) {
      setIsSidebarOpen(false)
      return
    }
    setActiveChatId(id)
    if (user?.id) {
      localStorage.setItem(`bujju_active_chat_${user.id}`, id)
    }
    setIsSidebarOpen(false)
    await loadConversationMessages(id)
  }

  // Delete a conversation
  const handleDeleteChat = async (id) => {
    handleStopSpeaking()
    try {
      const headers = await getAuthHeaders()
      await fetch(apiUrl(`/api/conversations/${id}`), {
        method: 'DELETE',
        headers,
      })
    } catch (err) {
      console.error('Error deleting conversation on server:', err)
    }

    setConversations((prev) => prev.filter((c) => c.id !== id))

    if (activeChatId === id) {
      const remaining = conversations.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        handleSelectChat(remaining[0].id)
      } else {
        setActiveChatId(null)
        setMessages([])
        setActiveFile(null)
      }
    }
  }

  // File upload handler
  const handleFileUpload = async (file, directError) => {
    if (directError) {
      setUploadError(directError)
      setUploadSuccess(null)
      return
    }
    if (!file || !user) return

    if (activeImage) {
      handleRemoveImage()
    }

    setUploadError(null)
    setUploadSuccess(null)
    setIsUploading(true)
    setUploadProgressText(`Uploading and processing ${file.name}...`)

    try {
      const authHeaders = await getAuthHeaders()
      const formData = new FormData()
      formData.append('file', file)

      // Do NOT set Content-Type header so fetch automatically adds the multipart boundary
      const headers = {}
      if (authHeaders.Authorization) {
        headers.Authorization = authHeaders.Authorization
      }
      if (authHeaders['x-user-id']) {
        headers['x-user-id'] = authHeaders['x-user-id']
      }

      const res = await fetch(apiUrl('/api/files/upload'), {
        method: 'POST',
        headers,
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload and process file.')
      }

      const newFile = {
        id: data.file_id,
        filename: data.filename,
        file_size: data.file_size,
        file_type: data.file_type,
      }
      setActiveFile(newFile)
      setUploadSuccess(`"${data.filename}" attached successfully! You can now ask questions about it.`)
    } catch (err) {
      console.error('File upload error:', err)
      setUploadError(sanitizeErrorMessage(err, 'File upload failed. Please try again.'))
    } finally {
      setIsUploading(false)
      setUploadProgressText('')
    }
  }

  // Remove attached file handler
  const handleRemoveFile = async () => {
    setActiveFile(null)
    setUploadError(null)
    setUploadSuccess(null)

    if (activeChatId) {
      try {
        const headers = await getAuthHeaders()
        await fetch(apiUrl(`/api/conversations/${activeChatId}/detach-file`), {
          method: 'POST',
          headers,
        })
      } catch (err) {
        console.warn('Could not detach file on backend:', err)
      }
    }
  }

  // Step 7: Image upload handler
  const handleImageUpload = (file, directError) => {
    if (directError) {
      setUploadError(directError)
      setUploadSuccess(null)
      return
    }
    if (!file || !user) return

    // Clean up previous image preview URL if any
    if (activeImage?.previewUrl) {
      URL.revokeObjectURL(activeImage.previewUrl)
    }

    const previewUrl = URL.createObjectURL(file)
    setActiveImage({
      file,
      previewUrl,
      name: file.name,
      size: file.size,
      type: file.type,
    })

    // If PDF was attached, remove it so they don't clash
    setActiveFile(null)
    setUploadError(null)
    setUploadSuccess(`"${file.name}" attached! Ask Bujju AI anything about this image.`)
  }

  // Remove attached image handler
  const handleRemoveImage = () => {
    if (activeImage?.previewUrl) {
      URL.revokeObjectURL(activeImage.previewUrl)
    }
    setActiveImage(null)
    setUploadError(null)
    setUploadSuccess(null)
  }

  // Send message
  const handleSend = async () => {
    if ((!input.trim() && !activeImage) || isLoading || !user) return

    handleStopSpeaking()

    const trimmedInput = input.trim() || 'What is in this image?'
    const currentImg = activeImage

    const userMessageDisplay = currentImg
      ? `[Image attached: ${currentImg.name}]\n${trimmedInput}`
      : trimmedInput

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: userMessageDisplay,
      timestamp: formatTime(null),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const authHeaders = await getAuthHeaders()
      let data

      if (currentImg) {
        // Step 7: Analyze image endpoint
        const formData = new FormData()
        formData.append('image', currentImg.file)
        formData.append('message', trimmedInput)
        if (activeChatId) {
          formData.append('conversation_id', activeChatId)
        }

        const headers = {}
        if (authHeaders.Authorization) headers.Authorization = authHeaders.Authorization
        if (authHeaders['x-user-id']) headers['x-user-id'] = authHeaders['x-user-id']

        const response = await fetch(apiUrl('/api/images/analyze'), {
          method: 'POST',
          headers,
          body: formData,
        })
        data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `Image analysis failed with status ${response.status}`)
        }

        // Clean up preview URL
        if (currentImg.previewUrl) {
          URL.revokeObjectURL(currentImg.previewUrl)
        }
        setActiveImage(null)

        const aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
          sources: data.sources || null,
          timestamp: formatTime(null),
        }
        setMessages((prev) => [...prev, aiReply])
      } else {
        // Normal chat, PDF chat, or Web Search with real-time streaming
        const response = await fetch(apiUrl('/api/chat'), {
          method: 'POST',
          headers: {
            ...authHeaders,
            Accept: 'text/event-stream, application/json',
          },
          body: JSON.stringify({
            conversation_id: activeChatId,
            file_id: activeFile?.id || null,
            message: trimmedInput,
            webSearch: isWebSearch,
            stream: true,
          }),
        })

        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/event-stream')) {
          const tempAiId = `ai-${Date.now()}`
          setMessages((prev) => [
            ...prev,
            {
              id: tempAiId,
              sender: 'ai',
              text: '',
              isStreaming: true,
              timestamp: formatTime(null),
            },
          ])
          data = await handleChatStream(response, tempAiId)
        } else {
          data = await response.json()
          if (!response.ok) {
            throw new Error(data.error || `Server returned error status ${response.status}`)
          }
          const aiReply = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: data.reply,
            sources: data.sources || null,
            timestamp: formatTime(null),
          }
          setMessages((prev) => [...prev, aiReply])
        }
      }

      // If backend returned or assigned a conversation ID, keep state synced
      if (data?.conversation_id && data.conversation_id !== activeChatId) {
        setActiveChatId(data.conversation_id)
        if (user?.id) {
          localStorage.setItem(`bujju_active_chat_${user.id}`, data.conversation_id)
        }
      }

      // Keep active file synced with conversation
      if (data?.file_id && data?.file_name && !activeFile) {
        setActiveFile({
          id: data.file_id,
          filename: data.file_name,
        })
      }

      // Update conversation title and file metadata in sidebar
      if (data?.title || data?.file_name) {
        setConversations((prev) => {
          const targetId = data.conversation_id || activeChatId
          const exists = prev.some((c) => c.id === targetId)
          if (exists) {
            return prev.map((c) =>
              c.id === targetId
                ? {
                    ...c,
                    title: data.title || c.title,
                    file_id: data.file_id || c.file_id,
                    file_name: data.file_name || c.file_name,
                  }
                : c,
            )
          }
          return [
            {
              id: targetId,
              user_id: user.id,
              title: data.title || 'New Chat',
              file_id: data.file_id || null,
              file_name: data.file_name || null,
              created_at: new Date().toISOString(),
            },
            ...prev,
          ]
        })
      }
    } catch (err) {
      console.error('Error in handleSend:', err)
      const cleanError = sanitizeErrorMessage(
        err,
        'Unable to connect to the AI service. Please verify your connection and try again.',
      )
      const errorReply = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        isError: true,
        text: cleanError,
        timestamp: formatTime(null),
      }
      setMessages((prev) => [...prev, errorReply])
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to consume Server-Sent Events stream from /api/chat
  const handleChatStream = async (response, tempAiId) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedText = ''
    let finalMeta = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const jsonStr = trimmed.slice(6)
        if (!jsonStr) continue

        try {
          const payload = JSON.parse(jsonStr)
          if (payload.type === 'chunk' && payload.text) {
            accumulatedText += payload.text
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAiId ? { ...m, text: accumulatedText, isStreaming: true } : m,
              ),
            )
          } else if (payload.type === 'done') {
            finalMeta = payload
            accumulatedText = payload.reply || accumulatedText
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempAiId
                  ? {
                      ...m,
                      text: accumulatedText,
                      sources: payload.sources || null,
                      isStreaming: false,
                    }
                  : m,
              ),
            )
          } else if (payload.type === 'error') {
            throw new Error(payload.error || 'Streaming error occurred.')
          }
        } catch (parseErr) {
          if (parseErr.message?.includes('Streaming error')) throw parseErr
        }
      }
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === tempAiId ? { ...m, isStreaming: false } : m)),
    )
    return finalMeta || { reply: accumulatedText }
  }

  // Clear messages in current view
  const handleClearChat = () => {
    handleStopSpeaking()
    if (isLoading) return
    setMessages([])
  }

  // Regenerate last response
  const handleRegenerate = async () => {
    handleStopSpeaking()
    const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user')
    if (!lastUserMessage || isLoading || !user) return

    setIsLoading(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: {
          ...headers,
          Accept: 'text/event-stream, application/json',
        },
        body: JSON.stringify({
          conversation_id: activeChatId,
          file_id: activeFile?.id || null,
          message: lastUserMessage.text,
          stream: true,
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/event-stream')) {
        const tempAiId = `ai-${Date.now()}`
        setMessages((prev) => [
          ...prev,
          {
            id: tempAiId,
            sender: 'ai',
            text: '',
            isStreaming: true,
            timestamp: formatTime(null),
          },
        ])
        await handleChatStream(response, tempAiId)
      } else {
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `Server returned error status ${response.status}`)
        }
        const aiReply = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: data.reply,
          timestamp: formatTime(null),
        }
        setMessages((prev) => [...prev, aiReply])
      }
    } catch (err) {
      console.error('Error regenerating chat response:', err)
      const errorReply = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        isError: true,
        text: sanitizeErrorMessage(err, 'Failed to regenerate response. Please try again.'),
        timestamp: formatTime(null),
      }
      setMessages((prev) => [...prev, errorReply])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectSuggestion = (suggestionText) => {
    setInput(suggestionText)
  }

  // Auth: Login
  const handleLogin = async (email, password) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (
            error.code === 'over_email_send_rate_limit' ||
            error.message?.includes('over_email_send_rate_limit') ||
            error.message?.toLowerCase().includes('rate limit') ||
            error.status === 429
          ) {
            return {
              success: false,
              error: 'Email sending limit reached. Please try again later.',
            }
          }
          return { success: false, error: error.message }
        }

        setUser(data.user)
        setSession(data.session)
        localStorage.setItem('bujju_user', JSON.stringify(data.user))
        return { success: true }
      } catch (err) {
        return { success: false, error: err.message || 'Login failed.' }
      }
    }

    // Local fallback when Supabase is not configured
    const mockUser = {
      id: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      name: email.split('@')[0],
      user_metadata: { name: email.split('@')[0] },
    }
    setUser(mockUser)
    localStorage.setItem('bujju_user', JSON.stringify(mockUser))
    return { success: true }
  }

  // Auth: Signup
  const handleSignup = async (name, email, password) => {
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
          },
        })

        if (error) {
          if (
            error.code === 'over_email_send_rate_limit' ||
            error.message?.includes('over_email_send_rate_limit') ||
            error.message?.toLowerCase().includes('rate limit') ||
            error.status === 429
          ) {
            return {
              success: false,
              error: 'Email sending limit reached. Please try again later.',
            }
          }
          return { success: false, error: error.message }
        }

        // When email confirmation is disabled in Supabase, data.session exists immediately
        if (data?.session) {
          setUser(data.user)
          setSession(data.session)
          localStorage.setItem('bujju_user', JSON.stringify(data.user))
          return { success: true }
        }

        // If email confirmation is enabled in Supabase, user must confirm via email
        return { success: true, requiresConfirmation: true }
      } catch (err) {
        const msg = err.message || ''
        if (
          err.code === 'over_email_send_rate_limit' ||
          msg.includes('over_email_send_rate_limit') ||
          msg.toLowerCase().includes('rate limit')
        ) {
          return {
            success: false,
            error: 'Email sending limit reached. Please try again later.',
          }
        }
        return { success: false, error: msg || 'Signup failed. Please try again.' }
      }
    }

    // Local fallback when Supabase is not configured
    const mockUser = {
      id: `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email,
      name,
      user_metadata: { name },
    }
    setUser(mockUser)
    localStorage.setItem('bujju_user', JSON.stringify(mockUser))
    return { success: true }
  }

  // Auth: Logout
  const handleLogout = async () => {
    handleStopSpeaking()
    if (supabase) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('Logout error:', err)
      }
    }
    setUser(null)
    setSession(null)
    setConversations([])
    setMessages([])
    setActiveChatId(null)
    setActiveFile(null)
    setUploadError(null)
    setUploadSuccess(null)
    localStorage.removeItem('bujju_user')
  }

  // While verifying session
  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading Bujju AI...</span>
        </div>
      </div>
    )
  }

  // If user is not logged in, render Login / Signup
  if (!user) {
    return <AuthPage onLogin={handleLogin} onSignup={handleSignup} initialMode="login" />
  }

  // Logged-in user view: Bujju AI Chat
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 font-sans antialiased text-neutral-100">
      {/* Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        recentChats={conversations}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Chat Area */}
      <ChatArea
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onNewChat={handleNewChat}
        onClearChat={handleClearChat}
        onRegenerate={handleRegenerate}
        onSelectSuggestion={handleSelectSuggestion}
        isLoading={isLoading}
        isChatLoading={isChatLoading}
        activeFile={activeFile}
        onUploadFile={handleFileUpload}
        onRemoveFile={handleRemoveFile}
        activeImage={activeImage}
        onUploadImage={handleImageUpload}
        onRemoveImage={handleRemoveImage}
        isUploading={isUploading}
        uploadProgressText={uploadProgressText}
        uploadError={uploadError}
        onDismissError={() => setUploadError(null)}
        uploadSuccess={uploadSuccess}
        onDismissSuccess={() => setUploadSuccess(null)}
        speakingMessageId={speakingMessageId}
        onToggleSpeak={handleToggleSpeak}
        onStopSpeaking={handleStopSpeaking}
        voiceRate={voiceRate}
        setVoiceRate={setVoiceRate}
        voiceLang={voiceLang}
        setVoiceLang={setVoiceLang}
        isWebSearch={isWebSearch}
        setIsWebSearch={setIsWebSearch}
      />
    </div>
  )
}
