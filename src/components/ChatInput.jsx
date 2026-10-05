import { useRef, useEffect, useState } from 'react'
import {
  ArrowUp,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Globe,
  Settings2,
} from 'lucide-react'
import {
  getSpeechRecognitionClass,
  isSpeechRecognitionSupported,
  SUPPORTED_VOICE_LANGUAGES,
  VOICE_SPEEDS,
} from '../utils/speech'

export default function ChatInput({
  input,
  setInput,
  onSend,
  isGenerating,
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
  isWebSearch = false,
  setIsWebSearch,
  voiceRate = 1.0,
  setVoiceRate,
  voiceLang = 'en-US',
  setVoiceLang,
}) {
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const recognitionRef = useRef(null)
  const baseInputRef = useRef('')

  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState(null)
  const [showVoiceSettings, setShowVoiceSettings] = useState(false)

  // Auto-resize textarea height up to a max
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
    }
  }, [])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((input.trim() || activeImage) && !isGenerating && !isUploading) {
        // If listening, stop listening before sending
        if (isListening) {
          stopListening()
        }
        onSend()
      }
    }
  }

  // File Upload Handlers (PDF)
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      onUploadFile(null, 'File larger than 10 MB. Maximum size is 10 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate file extension (PDF only)
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (ext !== '.pdf') {
      onUploadFile(null, 'Invalid file type. Only PDF files are supported.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Validate empty file
    if (file.size === 0) {
      onUploadFile(null, 'The uploaded file is empty.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    onUploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Image Upload Handlers (.jpg, .jpeg, .png, .webp)
  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate empty file
    if (file.size === 0) {
      onUploadImage(null, 'The uploaded image is empty.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }

    // Validate image size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      onUploadImage(null, 'Image is too large. Maximum size is 10 MB.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }

    // Validate image extension (.jpg, .jpeg, .png, .webp)
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    const allowed = ['.jpg', '.jpeg', '.png', '.webp']
    if (!allowed.includes(ext)) {
      onUploadImage(null, 'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are supported.')
      if (imageInputRef.current) imageInputRef.current.value = ''
      return
    }

    onUploadImage(file)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const formatFileSize = (bytes) => {
    if (!bytes || typeof bytes !== 'number') return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Speech Recognition (STT) Handlers
  const startListening = () => {
    setVoiceError(null)

    if (!isSpeechRecognitionSupported()) {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }

    const SpeechRecognitionClass = getSpeechRecognitionClass()
    if (!SpeechRecognitionClass) {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }

    try {
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = voiceLang || 'en-US'
      recognition.maxAlternatives = 1

      baseInputRef.current = input
      let finalTranscript = ''

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPiece = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece
          } else {
            interimTranscript += transcriptPiece
          }
        }

        const currentSpeech = finalTranscript || interimTranscript
        if (currentSpeech.trim()) {
          const prefix = baseInputRef.current ? `${baseInputRef.current.trim()} ` : ''
          setInput(`${prefix}${currentSpeech.trim()}`)
        }
      }

      recognition.onerror = (event) => {
        setIsListening(false)
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setVoiceError('Microphone permission is required for voice input.')
        } else if (event.error === 'no-speech') {
          setVoiceError("Couldn't hear anything. Please try again.")
        } else if (event.error === 'network') {
          setVoiceError('Speech recognition network error. Please try again.')
        } else if (event.error !== 'aborted') {
          setVoiceError('Speech recognition error. Please try again.')
        }
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.warn('Speech recognition initiation error:', err)
      setIsListening(false)
      setVoiceError('Microphone permission is required for voice input.')
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
    setIsListening(false)
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  const isSendDisabled = (!input.trim() && !activeImage) || isGenerating || isUploading

  return (
    <div className="w-full bg-gradient-to-t from-[#131314] via-[#131314]/95 to-transparent pt-2 pb-4 px-3 sm:px-6">
      <div className="max-w-3xl sm:max-w-4xl mx-auto">
        {/* Hidden File Input (PDF only) */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Hidden Image Input (.jpg, .jpeg, .png, .webp) */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleImageChange}
          className="hidden"
        />

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="mb-2.5 flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-amber-950/70 border border-amber-800/80 text-xs text-amber-200 shadow-md animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="truncate">{voiceError}</span>
            </div>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="p-1 rounded-md text-amber-400 hover:text-white hover:bg-amber-900/50 transition-colors shrink-0 cursor-pointer"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Listening State Banner */}
        {isListening && (
          <div className="mb-2.5 flex items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-[#1e1f20] border border-rose-500/50 text-xs text-rose-200 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
              </span>
              <span className="font-semibold text-rose-400">Listening...</span>
              <span className="text-[11px] text-[#8e918f] hidden sm:inline">
                Speak now. Speech will be transcribed into text below.
              </span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="px-2.5 py-1 rounded-full bg-rose-950 hover:bg-rose-900 text-[11px] font-medium text-rose-200 border border-rose-800/60 cursor-pointer transition-colors"
            >
              Stop
            </button>
          </div>
        )}

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="mb-2.5 flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-xs text-rose-200 shadow-md animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="truncate">{uploadError}</span>
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                className="p-1 rounded-md text-rose-400 hover:text-white hover:bg-rose-900/50 transition-colors shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Upload Success Banner */}
        {uploadSuccess && (
          <div className="mb-2.5 flex items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-[#1e1f20] border border-emerald-500/40 text-xs text-emerald-300 shadow-md animate-fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="truncate">{uploadSuccess}</span>
            </div>
            {onDismissSuccess && (
              <button
                type="button"
                onClick={onDismissSuccess}
                className="p-1 rounded-md text-emerald-400 hover:text-white hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Upload Progress State */}
        {isUploading && (
          <div className="mb-2.5 flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#1e1f20] border border-emerald-500/30 text-xs text-emerald-300 shadow-md">
            <Loader2 className="h-4 w-4 animate-spin shrink-0 text-emerald-400" />
            <span className="truncate">{uploadProgressText || 'Processing upload...'}</span>
          </div>
        )}

        {/* Active Attached Image Display & Preview */}
        {activeImage && (
          <div className="mb-2.5 p-2.5 rounded-2xl bg-[#1e1f20] border border-neutral-700/50 shadow-md">
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base select-none">🖼️</span>
                <span className="font-medium text-xs text-white truncate">{activeImage.name}</span>
                {activeImage.size && (
                  <span className="text-[11px] text-[#8e918f] shrink-0">
                    ({formatFileSize(activeImage.size)})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onRemoveImage}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-[#282a2c] transition-colors shrink-0 cursor-pointer"
                title="Remove attached image"
              >
                <span className="text-[11px] font-medium hidden sm:inline">Remove</span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {activeImage.previewUrl && (
              <div className="relative max-h-36 sm:max-h-44 w-fit rounded-xl overflow-hidden border border-neutral-700/50 bg-[#131314]">
                <img
                  src={activeImage.previewUrl}
                  alt={activeImage.name}
                  className="max-h-36 sm:max-h-44 max-w-full object-contain rounded-xl"
                />
              </div>
            )}
          </div>
        )}

        {/* Active Attached File Display (PDF) */}
        {activeFile && (
          <div className="mb-2.5 flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-[#1e1f20] border border-neutral-700/50 text-xs text-neutral-200 shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="font-medium truncate text-white">{activeFile.filename}</span>
              {activeFile.file_size && (
                <span className="text-[11px] text-[#8e918f] shrink-0">
                  ({formatFileSize(activeFile.file_size)})
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onRemoveFile}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-neutral-400 hover:text-rose-400 hover:bg-[#282a2c] transition-colors shrink-0 cursor-pointer"
              title="Remove attached file"
            >
              <span className="text-[11px] font-medium hidden sm:inline">Remove</span>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Active Web Search Indicator Pill */}
        {isWebSearch && (
          <div className="mb-2 flex items-center gap-2 px-3 py-1 rounded-full bg-[#1e1f20] border border-[#4285f4]/40 text-xs text-[#8ab4f8] w-fit animate-fade-in">
            <Globe className="h-3.5 w-3.5 text-[#4285f4]" />
            <span className="font-medium">Web Search mode active</span>
            <button
              type="button"
              onClick={() => setIsWebSearch && setIsWebSearch(false)}
              className="text-neutral-400 hover:text-white p-0.5 rounded-full transition-colors cursor-pointer"
              title="Disable Web Search"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Main Gemini Capsule Input Box */}
        <div
          className={`relative rounded-[28px] sm:rounded-[32px] bg-[#1e1f20] hover:bg-[#212224] focus-within:bg-[#282a2c] border transition-all duration-200 shadow-xl ${
            isListening
              ? 'border-rose-500/70 ring-2 ring-rose-500/20'
              : 'border-white/5 focus-within:border-neutral-600/70'
          }`}
        >
          <div className="flex items-end px-2 sm:px-3 py-1.5 sm:py-2">
            {/* Attachment & Feature Toolbar */}
            <div className="flex items-center shrink-0 gap-0.5 pb-1">
              {/* Paperclip Button (PDF) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isGenerating}
                className="p-2 sm:p-2.5 rounded-full text-[#c4c7c5] hover:text-white hover:bg-[#333538] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Attach PDF (Max 10 MB)"
                aria-label="Attach PDF"
              >
                <Paperclip className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Image Attachment Button */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading || isGenerating}
                className="p-2 sm:p-2.5 rounded-full text-[#c4c7c5] hover:text-white hover:bg-[#333538] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Attach Image (.jpg, .jpeg, .png, .webp - Max 10 MB)"
                aria-label="Attach Image"
              >
                <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              {/* Web Search Toggle Button */}
              {setIsWebSearch && (
                <button
                  type="button"
                  onClick={() => setIsWebSearch(!isWebSearch)}
                  className={`p-2 sm:p-2.5 rounded-full transition-colors cursor-pointer ${
                    isWebSearch
                      ? 'text-[#8ab4f8] bg-[#4285f4]/20 border border-[#4285f4]/40'
                      : 'text-[#c4c7c5] hover:text-white hover:bg-[#333538]'
                  }`}
                  title={isWebSearch ? 'Disable Web Search' : 'Web Search'}
                  aria-label="Web search"
                >
                  <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}

              {/* Microphone / Voice Input Button */}
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isGenerating || isUploading}
                className={`p-2 sm:p-2.5 rounded-full transition-all cursor-pointer ${
                  isListening
                    ? 'text-rose-400 bg-rose-500/15 border border-rose-500/40 animate-pulse'
                    : 'text-[#c4c7c5] hover:text-white hover:bg-[#333538]'
                }`}
                title={isListening ? 'Stop listening' : 'Voice input'}
                aria-label={isListening ? 'Stop listening' : 'Voice input'}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
                ) : (
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'Listening to speech...'
                  : activeImage
                  ? 'Ask something about this image...'
                  : activeFile
                  ? 'Ask something about this PDF...'
                  : isWebSearch
                  ? 'Search the web or ask Bujju AI...'
                  : 'Ask Bujju AI...'
              }
              className="flex-1 bg-transparent px-2.5 py-2 sm:py-2.5 text-[15px] sm:text-base text-[#e3e3e3] placeholder-[#8e918f] outline-none resize-none max-h-40 leading-relaxed"
            />

            {/* Send & Settings Controls */}
            <div className="flex items-center shrink-0 gap-1 pb-1">
              {/* Voice Settings Popover Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                  className="p-1.5 sm:p-2 rounded-full text-[#8e918f] hover:text-[#e3e3e3] hover:bg-[#333538] transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Voice settings (Speed & Language)"
                  aria-label="Voice settings"
                >
                  <Settings2 className="h-4 w-4" />
                  <span className="text-[11px] font-medium hidden md:inline">{voiceRate}x</span>
                </button>

                {/* Popover */}
                {showVoiceSettings && (
                  <div className="absolute bottom-12 right-0 w-56 p-3.5 rounded-2xl bg-[#1e1f20] border border-neutral-700/80 shadow-2xl z-30 text-xs text-neutral-200 animate-fade-in space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
                      <span className="font-semibold text-white text-xs">Voice Settings</span>
                      <button
                        type="button"
                        onClick={() => setShowVoiceSettings(false)}
                        className="text-neutral-400 hover:text-white p-0.5 rounded-full hover:bg-neutral-800 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Speed Selector */}
                    <div>
                      <div className="text-[11px] text-[#8e918f] mb-1.5 flex items-center justify-between">
                        <span>Speed</span>
                        <span className="text-[#8ab4f8] font-mono font-medium">{voiceRate}x</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {VOICE_SPEEDS.map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => {
                              if (setVoiceRate) setVoiceRate(speed)
                            }}
                            className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                              voiceRate === speed
                                ? 'bg-[#4285f4]/25 text-[#8ab4f8] border border-[#4285f4]/50'
                                : 'bg-[#282a2c] hover:bg-[#333538] text-neutral-300'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Language Selector */}
                    <div>
                      <div className="text-[11px] text-[#8e918f] mb-1.5">Language</div>
                      <select
                        value={voiceLang}
                        onChange={(e) => {
                          if (setVoiceLang) setVoiceLang(e.target.value)
                        }}
                        className="w-full bg-[#282a2c] border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none cursor-pointer focus:border-[#4285f4]"
                      >
                        {SUPPORTED_VOICE_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>
                            {lang.label} ({lang.native})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Gemini Circular Send Button */}
              <button
                type="button"
                onClick={onSend}
                disabled={isSendDisabled}
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center transition-all duration-150 ${
                  isSendDisabled
                    ? 'bg-[#282a2c] text-[#5e6062] cursor-not-allowed'
                    : 'bg-white text-black hover:bg-neutral-200 shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                }`}
                title="Send message"
                aria-label="Send message"
              >
                <ArrowUp className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>

        {/* Gemini Disclaimer */}
        <p className="text-center text-[11px] text-[#8e918f] mt-2.5 tracking-tight select-none">
          Bujju AI may display inaccurate info, including about people, so double-check its responses.
        </p>
      </div>
    </div>
  )
}
