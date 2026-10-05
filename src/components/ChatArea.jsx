import { useRef, useEffect, useState } from 'react'
import { PanelLeft, Sparkles, Plus, Trash2, Volume2, Square, Zap, ChevronDown } from 'lucide-react'
import ChatMessage from './ChatMessage'
import WelcomeScreen from './WelcomeScreen'
import ChatInput from './ChatInput'

function GeminiLoadingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0)

  const phases = [
    'Thinking and analyzing context...',
    'Consulting Gemini intelligence...',
    'Formulating high-quality response...',
    'Synthesizing insights...',
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % phases.length)
    }, 1800)
    return () => clearInterval(timer)
  }, [phases.length])

  return (
    <div className="w-full py-4 px-3 sm:px-6 bg-transparent animate-fade-in">
      <div className="max-w-4xl mx-auto flex items-start gap-3.5 sm:gap-4">
        {/* Gemini Aurora Avatar */}
        <div className="relative shrink-0 pt-0.5">
          <div className="relative h-8 w-8 rounded-full bg-gradient-to-tr from-[#4285f4] via-[#9b72cf] to-[#d96570] flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>

        {/* Shimmer & Animated Status */}
        <div className="flex-1 min-w-0 space-y-3 pt-0.5">
          {/* Header Status */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white tracking-wide">Bujju AI</span>
              <span className="text-[11px] text-[#8ab4f8] font-medium transition-all duration-300">
                {phases[phaseIndex]}
              </span>
            </div>

            {/* Equalizer Wave Bars */}
            <div className="flex items-center gap-1.5 h-4 px-2 py-0.5 rounded-full bg-[#1e1f20] border border-white/5">
              <Zap className="h-2.5 w-2.5 text-amber-400 animate-pulse" />
              <span className="text-[10px] text-neutral-300 font-mono">Flash Engine</span>
              <div className="flex items-center gap-0.5 ml-1">
                <span
                  className="w-1 h-2 rounded-full bg-[#4285f4]"
                  style={{ animation: 'gemini-wave-bar 1s ease-in-out infinite 0ms' }}
                />
                <span
                  className="w-1 h-2.5 rounded-full bg-[#9b72cf]"
                  style={{ animation: 'gemini-wave-bar 1s ease-in-out infinite 200ms' }}
                />
                <span
                  className="w-1 h-2 rounded-full bg-[#d96570]"
                  style={{ animation: 'gemini-wave-bar 1s ease-in-out infinite 400ms' }}
                />
              </div>
            </div>
          </div>

          {/* Shimmering Skeleton Lines */}
          <div className="space-y-2 py-1">
            <div className="h-3 sm:h-3.5 w-[88%] rounded-full gemini-shimmer-bar border border-white/5" />
            <div className="h-3 sm:h-3.5 w-[72%] rounded-full gemini-shimmer-bar border border-white/5" />
            <div className="h-3 sm:h-3.5 w-[50%] rounded-full gemini-shimmer-bar border border-white/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatArea({
  onToggleSidebar,
  messages,
  input,
  setInput,
  onSend,
  onNewChat,
  onClearChat,
  onRegenerate,
  onSelectSuggestion,
  isLoading,
  isChatLoading = false,
  activeFile,
  onUploadFile,
  onRemoveFile,
  activeImage,
  onUploadImage,
  onRemoveImage,
  isUploading,
  uploadProgressText,
  uploadError,
  onDismissError,
  uploadSuccess,
  onDismissSuccess,
  speakingMessageId,
  onToggleSpeak,
  onStopSpeaking,
  voiceRate,
  setVoiceRate,
  voiceLang,
  setVoiceLang,
  isWebSearch,
  setIsWebSearch,
  user,
}) {
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131314] text-neutral-100 overflow-hidden relative">
      {/* Top Navbar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-3 sm:px-6 border-b border-white/5 bg-[#131314]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-[#1e1f20] transition-colors md:hidden cursor-pointer"
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>

          {/* Gemini Model Status Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-xs text-[#e3e3e3] border border-white/5 transition-colors cursor-pointer select-none">
            <span className="font-semibold text-white tracking-tight">Bujju AI</span>
            <span className="text-[11px] text-[#8e918f] font-normal">Gemini 3.6 Flash</span>
            <ChevronDown className="h-3 w-3 text-neutral-400" />
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                isLoading
                  ? 'bg-amber-500/15 text-amber-400 animate-pulse'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {isLoading ? 'Thinking...' : 'Active'}
            </span>
          </div>

          {/* Web Search indicator if enabled */}
          {isWebSearch && (
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1e1f20] border border-[#4285f4]/30 text-[11px] font-medium text-[#8ab4f8]">
              🌐 Web Search
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {/* Global Stop Speaking button if active */}
          {speakingMessageId && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer animate-pulse"
              title="Stop speaking"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop Speaking</span>
            </button>
          )}

          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#e3e3e3] bg-[#1e1f20] hover:bg-[#282a2c] border border-white/5 transition-colors cursor-pointer"
            title="Start new chat"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New chat</span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              disabled={isLoading}
              className={`p-2 rounded-full transition-colors ${
                isLoading
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-400 hover:text-rose-400 hover:bg-[#1e1f20] cursor-pointer'
              }`}
              title="Clear chat messages"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Chat Body (Scrollable) */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {isChatLoading ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400">
            <div className="flex flex-col items-center gap-2.5">
              <div className="h-6 w-6 rounded-full border-2 border-[#4285f4] border-t-transparent animate-spin" />
              <span className="text-xs text-neutral-400">Loading conversation...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen onSelectSuggestion={onSelectSuggestion} user={user} />
        ) : (
          <div className="py-4 space-y-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onRegenerate={msg.sender === 'ai' ? onRegenerate : undefined}
                isSpeaking={speakingMessageId === msg.id}
                onToggleSpeak={msg.sender === 'ai' ? onToggleSpeak : undefined}
              />
            ))}

            {/* Gemini Loading / Typing Indicator */}
            {isLoading && !messages.some((m) => m.isStreaming) && (
              <GeminiLoadingIndicator />
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Global Speaking Float Bar */}
      {speakingMessageId && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 rounded-full bg-[#1e1f20]/95 border border-[#4285f4]/40 text-xs text-white shadow-2xl backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-[#8ab4f8] animate-pulse" />
            <span className="font-medium text-[#8ab4f8]">Bujju AI is reading aloud</span>
            <span className="text-neutral-400 text-[11px]">({voiceRate}x)</span>
          </div>
          <button
            type="button"
            onClick={onStopSpeaking}
            className="px-2.5 py-0.5 rounded-full bg-[#282a2c] hover:bg-[#333538] text-neutral-300 hover:text-white transition-colors cursor-pointer text-[11px] font-medium"
          >
            Stop
          </button>
        </div>
      )}

      {/* Message Input Bar */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={onSend}
        isGenerating={isLoading}
        activeFile={activeFile}
        onUploadFile={onUploadFile}
        onRemoveFile={onRemoveFile}
        activeImage={activeImage}
        onUploadImage={onUploadImage}
        onRemoveImage={onRemoveImage}
        isUploading={isUploading}
        uploadProgressText={uploadProgressText}
        uploadError={uploadError}
        onDismissError={onDismissError}
        uploadSuccess={uploadSuccess}
        onDismissSuccess={onDismissSuccess}
        isWebSearch={isWebSearch}
        setIsWebSearch={setIsWebSearch}
        voiceRate={voiceRate}
        setVoiceRate={setVoiceRate}
        voiceLang={voiceLang}
        setVoiceLang={setVoiceLang}
      />
    </div>
  )
}
