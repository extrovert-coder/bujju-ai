import { useState, useEffect, useCallback, useRef } from 'react'
import { usePwaInstall } from './utils/pwa'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import AuthPage from './components/AuthPage'
import LandingPage from './components/LandingPage'
import MemoryModal from './components/MemoryModal'
import RemindersModal from './components/RemindersModal'
import SplashScreen from './components/SplashScreen'
import CodingWorkspace from './components/CodingWorkspace'
import PwaInstallModal from './components/PwaInstallModal'
import { BujjuIcon } from './components/BujjuLogo'
import { Bell, Check, X } from 'lucide-react'
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

let messageSequence = 0
function createMessageId(prefix = 'msg') {
  messageSequence += 1
  return `${prefix}-${Date.now()}-${messageSequence}`
}

export default function App() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isInitializingAuth, setIsInitializingAuth] = useState(true)
  const [authMode, setAuthMode] = useState(null) // null = LandingPage, 'login', 'signup'

  // Splash Screen: session-scoped for new tabs only (never repeats in same tab)
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return !sessionStorage.getItem('bujju_ai_splash_seen')
    } catch {
      return false
    }
  })

  const [currentView, setCurrentView] = useState('chat') // 'chat' | 'code'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)

  // Real-time server-authoritative AI quota states
  const [usage, setUsage] = useState(null)
  const [isUsageLoading, setIsUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState(null)

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

  // Continuous Self-Training & User Memory states
  const [isMemoryOpen, setIsMemoryOpen] = useState(false)
  const [memories, setMemories] = useState([])
  const [isMemoryLoading, setIsMemoryLoading] = useState(false)

  // Reminders states (Phase 2)
  const [isRemindersOpen, setIsRemindersOpen] = useState(false)
  const [reminders, setReminders] = useState([])
  const [isRemindersLoading, setIsRemindersLoading] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  )
  const [dueAlert, setDueAlert] = useState(null)
  const notifiedReminderIdsRef = useRef(new Set())

  // PWA install hook
  const { isInstallable, installApp, isIos, isInstalled, installInfo } = usePwaInstall()
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false)

  // Global Escape key: close open modals/drawer
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      if (isInstallGuideOpen) { setIsInstallGuideOpen(false); return }
      if (isMemoryOpen) { setIsMemoryOpen(false); return }
      if (isRemindersOpen) { setIsRemindersOpen(false); return }
      if (isSidebarOpen) { setIsSidebarOpen(false); return }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isInstallGuideOpen, isMemoryOpen, isRemindersOpen, isSidebarOpen])

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

  // Splash finish handler: set session-scoped flag so it never repeats in same tab
  const handleSplashFinish = useCallback(() => {
    try {
      sessionStorage.setItem('bujju_ai_splash_seen', 'true')
    } catch {}
    setShowSplash(false)
  }, [])

  // Check auth session on mount and subscribe to changes
  useEffect(() => {
    let authDone = false
    // Safety max timeout: never freeze forever on slow auth initialization
    const safetyTimeout = setTimeout(() => {
      if (!authDone) {
        setIsInitializingAuth(false)
      }
    }, 4500)

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
        authDone = true
        clearTimeout(safetyTimeout)
        setIsInitializingAuth(false)
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
          setUsage(null)
          setReminders([])
          setDueAlert(null)
          notifiedReminderIdsRef.current.clear()
        }
      })

      return () => {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  // Load conversation messages by ID - ONLY called when a specific active conversation exists
  const loadConversationMessages = useCallback(
    async (convId) => {
      if (!convId || !user) return
      setIsLoadingMessages(true)
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
        setIsLoadingMessages(false)
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

  // Start a fresh new chat: resets active chat and displays clean welcome screen immediately
  const handleNewChat = useCallback(() => {
    if (!user) return

    handleStopSpeaking()
    setCurrentView('chat')
    setActiveFile(null)
    setActiveImage((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return null
    })
    setUploadError(null)
    setUploadSuccess(null)
    setActiveChatId(null)
    setMessages([])
    setIsSidebarOpen(false)
  }, [user, handleStopSpeaking])

  // Fetch conversations independently in background whenever user logs in or switches
  useEffect(() => {
    if (!user) return

    let isMounted = true

    async function fetchUserConversations() {
      setIsLoadingConversations(true)
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
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to fetch user conversations:', err)
        setConversations([])
      } finally {
        if (isMounted) {
          setIsLoadingConversations(false)
        }
      }
    }

    fetchUserConversations()

    return () => {
      isMounted = false
    }
  }, [user, getAuthHeaders])

  // Independent fetch of usage whenever user logs in or switches
  useEffect(() => {
    if (!user) return
    let isSubscribed = true

    async function loadInitialUsage() {
      setIsUsageLoading(true)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(apiUrl('/api/usage'), { headers })
        if (res.ok && isSubscribed) {
          const data = await res.json()
          setUsage(data)
          setUsageError(null)
        } else if (isSubscribed) {
          setUsageError('Usage unavailable')
        }
      } catch (err) {
        if (isSubscribed) {
          console.warn('[Bujju AI] Failed to fetch usage:', err)
          setUsageError('Usage unavailable')
        }
      } finally {
        if (isSubscribed) {
          setIsUsageLoading(false)
        }
      }
    }

    loadInitialUsage()

    return () => {
      isSubscribed = false
    }
  }, [user, getAuthHeaders])

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
    setCurrentView('chat')
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

  // Fetch learned memories from backend
  const fetchMemories = useCallback(async () => {
    if (!user) return
    setIsMemoryLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(apiUrl('/api/memories'), { headers })
      if (res.ok) {
        const data = await res.json()
        setMemories(Array.isArray(data.memories) ? data.memories : [])
      }
    } catch (err) {
      console.warn('[Bujju AI Memory] Failed to fetch memories:', err)
    } finally {
      setIsMemoryLoading(false)
    }
  }, [user, getAuthHeaders])

  // Initial fetch of memories whenever user logs in or changes
  useEffect(() => {
    if (!user?.id) return
    let isSubscribed = true

    async function loadInitialMemories() {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(apiUrl('/api/memories'), { headers })
        if (res.ok && isSubscribed) {
          const data = await res.json()
          setMemories(Array.isArray(data.memories) ? data.memories : [])
        }
      } catch (err) {
        console.warn('[Bujju AI Memory] Failed to fetch memories:', err)
      }
    }

    loadInitialMemories()

    return () => {
      isSubscribed = false
    }
  }, [user?.id, getAuthHeaders])

  // Teach Bujju AI a new memory / instruction manually
  const handleTeachMemory = async (fact, category) => {
    const headers = await getAuthHeaders()
    const res = await fetch(apiUrl('/api/memories'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ fact, category }),
    })
    if (!res.ok) throw new Error('Failed to teach memory.')
    const data = await res.json()
    if (data.memory) {
      setMemories((prev) => [
        data.memory,
        ...prev.filter((m) => m.id !== data.memory.id),
      ])
    }
  }

  // Forget a specific memory
  const handleDeleteMemory = async (id) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    try {
      const headers = await getAuthHeaders()
      await fetch(apiUrl(`/api/memories/${id}`), {
        method: 'DELETE',
        headers,
      })
    } catch (err) {
      console.warn('[Bujju AI Memory] Failed to delete memory on server:', err)
    }
  }

  // Clear all learned memories
  const handleClearMemories = async () => {
    setMemories([])
    try {
      const headers = await getAuthHeaders()
      await fetch(apiUrl('/api/memories'), {
        method: 'DELETE',
        headers,
      })
    } catch (err) {
      console.warn('[Bujju AI Memory] Failed to clear memories on server:', err)
    }
  }

  // Fetch user reminders (Phase 2)
  const fetchReminders = useCallback(async () => {
    if (!user?.id) return
    setIsRemindersLoading(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(apiUrl('/api/reminders'), { headers })
      if (res.ok) {
        const data = await res.json()
        setReminders(Array.isArray(data.reminders) ? data.reminders : [])
      }
    } catch (err) {
      console.warn('[Bujju AI Reminders] Failed to fetch reminders:', err)
    } finally {
      setIsRemindersLoading(false)
    }
  }, [user?.id, getAuthHeaders])

  // Initial fetch of reminders when user logs in
  useEffect(() => {
    if (!user?.id) return
    let isSubscribed = true

    async function loadInitialReminders() {
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(apiUrl('/api/reminders'), { headers })
        if (res.ok && isSubscribed) {
          const data = await res.json()
          setReminders(Array.isArray(data.reminders) ? data.reminders : [])
        }
      } catch (err) {
        console.warn('[Bujju AI Reminders] Failed to fetch reminders:', err)
      }
    }

    loadInitialReminders()

    return () => {
      isSubscribed = false
    }
  }, [user?.id, getAuthHeaders])

  // Create a new reminder
  const handleCreateReminder = async ({ title, notes, due_at }) => {
    const headers = await getAuthHeaders()
    const res = await fetch(apiUrl('/api/reminders'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, notes, due_at }),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Failed to create reminder.')
    }
    const data = await res.json()
    if (data.reminder) {
      setReminders((prev) => [data.reminder, ...prev])
    }
    return data.reminder
  }

  // Update a reminder (edit or toggle completion)
  const handleUpdateReminder = async (id, updates) => {
    const headers = await getAuthHeaders()
    const res = await fetch(apiUrl(`/api/reminders/${id}`), {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Failed to update reminder.')
    }
    const data = await res.json()
    if (data.reminder) {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...data.reminder } : r)),
      )
      if (updates.completed && dueAlert?.id === id) {
        setDueAlert(null)
      }
    }
    return data.reminder
  }

  // Delete a reminder
  const handleDeleteReminder = async (id) => {
    setReminders((prev) => prev.filter((r) => r.id !== id))
    if (dueAlert?.id === id) {
      setDueAlert(null)
    }
    try {
      const headers = await getAuthHeaders()
      await fetch(apiUrl(`/api/reminders/${id}`), {
        method: 'DELETE',
        headers,
      })
    } catch (err) {
      console.warn('[Bujju AI Reminders] Failed to delete reminder:', err)
    }
  }

  // Request browser notification permission
  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission()
        setNotificationPermission(permission)
      } catch (err) {
        console.warn('Failed to request notification permission:', err)
      }
    }
  }

  // Background poller & timer for due reminders
  useEffect(() => {
    if (!user?.id || reminders.length === 0) return

    const checkDueReminders = () => {
      const now = Date.now()
      const dueItems = reminders.filter(
        (r) => !r.completed && new Date(r.due_at).getTime() <= now,
      )

      for (const item of dueItems) {
        if (!notifiedReminderIdsRef.current.has(item.id)) {
          notifiedReminderIdsRef.current.add(item.id)

          // 1. Browser desktop notification if granted
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification(`⏰ Reminder: ${item.title}`, {
                body: item.notes || `Scheduled for ${new Date(item.due_at).toLocaleTimeString()}`,
                icon: '/favicon.ico',
              })
            } catch (notifErr) {
              console.warn('[Reminders] Browser notification error:', notifErr)
            }
          }

          // 2. In-app due reminder banner
          setDueAlert(item)
        }
      }
    }

    checkDueReminders()
    const timer = setInterval(checkDueReminders, 15000)
    return () => clearInterval(timer)
  }, [user?.id, reminders])

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
    if ((!input.trim() && !activeImage) || isSendingMessage || !user) return

    handleStopSpeaking()

    const trimmedInput = input.trim() || 'What is in this image?'
    const currentImg = activeImage

    const userMessageDisplay = currentImg
      ? `[Image attached: ${currentImg.name}]\n${trimmedInput}`
      : trimmedInput

    const userMsg = {
      id: createMessageId('u'),
      sender: 'user',
      text: userMessageDisplay,
      timestamp: formatTime(null),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsSendingMessage(true)

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error('AI generation timed out. Please try again.'))
    }, 90000)

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
          signal: abortController.signal,
        })
        data = await response.json()
        if (!response.ok) {
          if (data?.usage) setUsage(data.usage)
          throw new Error(data.error || `Image analysis failed with status ${response.status}`)
        }

        if (data?.usage) setUsage(data.usage)

        // Clean up preview URL
        if (currentImg.previewUrl) {
          URL.revokeObjectURL(currentImg.previewUrl)
        }
        setActiveImage(null)

        const aiReply = {
          id: createMessageId('ai'),
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
          signal: abortController.signal,
        })

        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/event-stream')) {
          const tempAiId = createMessageId('ai')
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
          if (data?.usage) setUsage(data.usage)
        } else {
          data = await response.json()
          if (!response.ok) {
            if (data?.usage) setUsage(data.usage)
            throw new Error(data.error || `Server returned error status ${response.status}`)
          }
          if (data?.usage) setUsage(data.usage)
          const aiReply = {
            id: createMessageId('ai'),
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
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timed out')
      const cleanError = isTimeout
        ? 'AI generation timed out. Please try again.'
        : sanitizeErrorMessage(
            err,
            'Unable to connect to the AI service. Please verify your connection and try again.',
          )
      const errorReply = {
        id: createMessageId('err'),
        sender: 'ai',
        isError: true,
        text: cleanError,
        timestamp: formatTime(null),
      }
      setMessages((prev) => [
        ...prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        errorReply,
      ])
    } finally {
      clearTimeout(timeoutId)
      setIsSendingMessage(false)
      // Allow background extraction to complete then refresh learned memory badge
      setTimeout(() => {
        fetchMemories()
      }, 2200)
    }
  }

  // Helper to consume Server-Sent Events stream from /api/chat
  const handleChatStream = async (response, tempAiId) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let accumulatedText = ''
    let finalMeta = null
    let streamDone = false

    const processLine = (line) => {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) return
      const jsonStr = trimmed.slice(6).trim()
      if (!jsonStr) return

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
          streamDone = true
          finalMeta = payload
          accumulatedText = payload.reply || accumulatedText
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAiId
                ? {
                    ...m,
                    text: accumulatedText,
                    sources: payload.sources || m.sources || null,
                    isStreaming: false,
                  }
                : m,
            ),
          )
        } else if (payload.type === 'error') {
          streamDone = true
          throw new Error(payload.error || 'AI generation failed.')
        }
      } catch (parseErr) {
        if (parseErr.message?.includes('AI generation failed')) throw parseErr
      }
    }

    try {
      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            processLine(buffer)
            buffer = ''
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          processLine(line)
          if (streamDone) break
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {}
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAiId
            ? {
                ...m,
                text: accumulatedText,
                sources: finalMeta?.sources || m.sources || null,
                isStreaming: false,
              }
            : m,
        ),
      )
    }

    return finalMeta || { reply: accumulatedText }
  }

  // Clear messages in current view
  const handleClearChat = () => {
    handleStopSpeaking()
    if (isSendingMessage) return
    setMessages([])
  }

  // Regenerate last response
  const handleRegenerate = async () => {
    handleStopSpeaking()
    const lastUserMessage = [...messages].reverse().find((m) => m.sender === 'user')
    if (!lastUserMessage || isSendingMessage || !user) return

    setIsSendingMessage(true)
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error('AI generation timed out. Please try again.'))
    }, 90000)

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
        signal: abortController.signal,
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
        const streamData = await handleChatStream(response, tempAiId)
        if (streamData?.usage) setUsage(streamData.usage)
      } else {
        const data = await response.json()
        if (!response.ok) {
          if (data?.usage) setUsage(data.usage)
          throw new Error(data.error || `Server returned error status ${response.status}`)
        }
        if (data?.usage) setUsage(data.usage)
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
      const isTimeout = err.name === 'AbortError' || err.message?.includes('timed out')
      const cleanError = isTimeout
        ? 'AI generation timed out. Please try again.'
        : sanitizeErrorMessage(err, 'Failed to regenerate response. Please try again.')
      const errorReply = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        isError: true,
        text: cleanError,
        timestamp: formatTime(null),
      }
      setMessages((prev) => [
        ...prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
        errorReply,
      ])
    } finally {
      clearTimeout(timeoutId)
      setIsSendingMessage(false)
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
    setAuthMode(null)
    setConversations([])
    setMessages([])
    setActiveChatId(null)
    setActiveFile(null)
    setUploadError(null)
    setUploadSuccess(null)
    setReminders([])
    setDueAlert(null)
    notifiedReminderIdsRef.current.clear()
    localStorage.removeItem('bujju_user')
  }

  // 1. Premium Splash Screen (shown ONLY in new tabs, never on refresh in same tab)
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />
  }

  // 2. While verifying auth session (subtle brand loader, avoids flash)
  if (isInitializingAuth) {
    return (
      <div className="h-screen w-screen bg-[#131314] flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3.5">
          <BujjuIcon size={48} animated={true} glow={true} />
          <span className="text-xs font-medium text-neutral-400 tracking-wide">Loading Bujju AI...</span>
        </div>
      </div>
    )
  }

  // 3. Unauthenticated experience: Show AuthPage when user chooses Login/Get Started, otherwise show LandingPage
  if (!user) {
    if (authMode) {
      return (
        <AuthPage
          onLogin={handleLogin}
          onSignup={handleSignup}
          initialMode={authMode}
          onBack={() => setAuthMode(null)}
        />
      )
    }

    return (
      <LandingPage
        onLogin={() => setAuthMode('login')}
        onGetStarted={() => setAuthMode('signup')}
      />
    )
  }

  // 4. Logged-in user view: Bujju AI Chat
  return (
    <div className="flex h-[100dvh] w-full max-w-full overflow-hidden bg-neutral-950 font-sans antialiased text-neutral-100">
      {/* Left Sidebar - Conversation list loads independently in background */}
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
        onOpenMemory={() => {
          setIsMemoryOpen(true)
          fetchMemories()
        }}
        memoriesCount={memories.length}
        onOpenReminders={() => {
          setIsRemindersOpen(true)
          fetchReminders()
        }}
        pendingRemindersCount={reminders.filter((r) => !r.completed).length}
        isLoadingConversations={isLoadingConversations}
        currentView={currentView}
        onSelectView={setCurrentView}
        isInstallable={isInstallable}
        onInstallApp={installApp}
        isIosPwa={isIos}
        isInstalled={isInstalled}
        onOpenInstallGuide={() => setIsInstallGuideOpen(true)}
      />

      {/* Main View: Chat Area OR Coding Workspace */}
      {currentView === 'chat' ? (
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
          isLoading={isSendingMessage}
          isSendingMessage={isSendingMessage}
          isLoadingMessages={isLoadingMessages}
          isChatLoading={isLoadingMessages}
          activeChatId={activeChatId}
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
          user={user}
          onOpenMemory={() => {
            setIsMemoryOpen(true)
            fetchMemories()
          }}
          memoriesCount={memories.length}
          onOpenReminders={() => {
            setIsRemindersOpen(true)
            fetchReminders()
          }}
          pendingRemindersCount={reminders.filter((r) => !r.completed).length}
          usage={usage}
          isUsageLoading={isUsageLoading}
          usageError={usageError}
          onSelectView={setCurrentView}
        />
      ) : (
        <CodingWorkspace
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onBackToChat={() => setCurrentView('chat')}
          user={user}
          getAuthHeaders={getAuthHeaders}
        />
      )}

      {/* Continuous Self-Training & Memory Modal */}
      <MemoryModal
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memories={memories}
        onTeachMemory={handleTeachMemory}
        onDeleteMemory={handleDeleteMemory}
        onClearMemories={handleClearMemories}
        isLoading={isMemoryLoading}
      />

      {/* Reminders & Alerts Modal (Phase 2) */}
      <RemindersModal
        isOpen={isRemindersOpen}
        onClose={() => setIsRemindersOpen(false)}
        reminders={reminders}
        onCreateReminder={handleCreateReminder}
        onUpdateReminder={handleUpdateReminder}
        onDeleteReminder={handleDeleteReminder}
        isLoading={isRemindersLoading}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestNotificationPermission}
      />

      {/* PWA Installation Guide Modal */}
      <PwaInstallModal
        isOpen={isInstallGuideOpen}
        onClose={() => setIsInstallGuideOpen(false)}
        isInstallable={isInstallable}
        onInstallApp={installApp}
        isInstalled={isInstalled}
        installInfo={installInfo}
      />

      {/* In-App Due Reminder Floating Alert Banner */}
      {dueAlert && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full p-4 rounded-2xl bg-[#1e1f20] border border-amber-500/50 text-white shadow-2xl animate-fade-in backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Bell className="h-4 w-4 animate-bounce" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Reminder Due
                </p>
                <p className="text-xs font-semibold text-white truncate mt-0.5">
                  {dueAlert.title}
                </p>
                {dueAlert.notes && (
                  <p className="text-[11px] text-neutral-300 line-clamp-2 mt-1">
                    {dueAlert.notes}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDueAlert(null)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              title="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => {
                handleUpdateReminder(dueAlert.id, { completed: true })
                setDueAlert(null)
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer"
            >
              <Check className="h-3 w-3" />
              <span>Mark Complete</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRemindersOpen(true)
                setDueAlert(null)
              }}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-[#282a2c] text-white hover:bg-[#333538] transition-colors cursor-pointer"
            >
              View Reminders
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
