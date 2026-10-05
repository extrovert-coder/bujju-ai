import { useState } from 'react'
import {
  Sparkles,
  User,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  AlertCircle,
  Volume2,
  VolumeX,
  ExternalLink,
} from 'lucide-react'

// Single-pass lexical tokenizer for Gemini-quality code syntax highlighting
function tokenizeCode(code) {
  if (!code) return []

  const TOKEN_REGEX =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#(?:include|define|pragma|ifndef|ifdef|endif)[^\n]*)|(\b(?:int|char|double|float|bool|void|long|short|unsigned|signed|struct|typedef|union|enum|const|let|var|function|def|class|import|from|export|default|return|if|else|while|for|do|break|continue|switch|case|true|false|null|nullptr|nil|None|True|False|async|await|try|catch|finally|throw|new|this|self|public|private|protected|static|sizeof)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?(?:f|u|l)?\b)|(\s+)|([^\s\w]+)|([a-zA-Z_][a-zA-Z0-9_]*)/g

  let match
  const tokens = []

  while ((match = TOKEN_REGEX.exec(code)) !== null) {
    const [raw, comment, str, prep, kw, fn, num] = match
    if (comment) {
      tokens.push({ type: 'comment', value: raw })
    } else if (str) {
      tokens.push({ type: 'string', value: raw })
    } else if (prep) {
      tokens.push({ type: 'preprocessor', value: raw })
    } else if (kw) {
      tokens.push({ type: 'keyword', value: raw })
    } else if (fn) {
      tokens.push({ type: 'function', value: raw })
    } else if (num) {
      tokens.push({ type: 'number', value: raw })
    } else {
      tokens.push({ type: 'plain', value: raw })
    }
  }

  return tokens
}

// Render tokenized code as clean, safe React spans (no HTML string replaces)
function CodeContent({ code }) {
  const tokens = tokenizeCode(code)

  return (
    <code>
      {tokens.map((token, index) => {
        switch (token.type) {
          case 'comment':
            return (
              <span key={index} className="text-neutral-500 italic">
                {token.value}
              </span>
            )
          case 'string':
            return (
              <span key={index} className="text-emerald-300">
                {token.value}
              </span>
            )
          case 'preprocessor':
            return (
              <span key={index} className="text-pink-400 font-semibold">
                {token.value}
              </span>
            )
          case 'keyword':
            return (
              <span key={index} className="text-purple-400 font-semibold">
                {token.value}
              </span>
            )
          case 'function':
            return (
              <span key={index} className="text-sky-300 font-medium">
                {token.value}
              </span>
            )
          case 'number':
            return (
              <span key={index} className="text-amber-400">
                {token.value}
              </span>
            )
          default:
            return <span key={index}>{token.value}</span>
        }
      })}
    </code>
  )
}

// Google Gemini styled CodeBlock
function CodeBlock({ language, code, isIncomplete = false }) {
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const cleanLang = (language || 'code').trim()

  return (
    <div className="my-4 rounded-2xl overflow-hidden border border-neutral-700/60 bg-[#16171a] shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#202124] border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="font-mono text-xs font-semibold text-neutral-300 uppercase tracking-wider">
            {cleanLang}
          </span>
          {isIncomplete && (
            <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              generating...
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-700/90 border border-neutral-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-neutral-400" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="relative p-4 sm:p-5 overflow-x-auto selection:bg-emerald-500/30">
        <pre className="font-mono text-[13px] sm:text-[14px] leading-relaxed text-neutral-200">
          <CodeContent code={code} />
        </pre>
      </div>
    </div>
  )
}

export default function ChatMessage({ message, onRegenerate, isSpeaking = false, onToggleSpeak }) {
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'like' | 'dislike' | null

  const isAi = message.sender === 'ai'
  const isError = Boolean(message.isError)
  const isStreaming = Boolean(message.isStreaming)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Parse inline text with bold, italic, and inline code
  const renderInlineMarkdown = (text) => {
    if (!text) return null
    // Matches: `code`, **bold**, *italic*
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g)
    return tokens.map((token, i) => {
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 mx-0.5 rounded-md font-mono text-xs text-emerald-300 bg-neutral-800/90 border border-neutral-700/60"
          >
            {token.slice(1, -1)}
          </code>
        )
      }
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        return (
          <strong key={i} className="font-semibold text-white">
            {token.slice(2, -2)}
          </strong>
        )
      }
      if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
        return (
          <em key={i} className="italic text-neutral-200">
            {token.slice(1, -1)}
          </em>
        )
      }
      return token
    })
  }

  // Bulletproof markdown parser handling CRLF, in-progress code fences, and structure
  const parseMarkdownBlocks = (rawContent) => {
    if (!rawContent) return []
    const normalized = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalized.split('\n')
    const blocks = []

    let inCodeBlock = false
    let currentCodeLines = []
    let currentLang = ''
    let currentTextLines = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed.startsWith('```')) {
        if (!inCodeBlock) {
          if (currentTextLines.length > 0) {
            blocks.push({ type: 'text', content: currentTextLines.join('\n') })
            currentTextLines = []
          }
          inCodeBlock = true
          currentLang = trimmed.slice(3).trim()
          currentCodeLines = []
        } else {
          inCodeBlock = false
          blocks.push({
            type: 'code',
            language: currentLang || 'code',
            code: currentCodeLines.join('\n'),
            isIncomplete: false,
          })
          currentCodeLines = []
          currentLang = ''
        }
      } else if (inCodeBlock) {
        currentCodeLines.push(line)
      } else {
        currentTextLines.push(line)
      }
    }

    if (inCodeBlock) {
      blocks.push({
        type: 'code',
        language: currentLang || 'code',
        code: currentCodeLines.join('\n'),
        isIncomplete: true,
      })
    } else if (currentTextLines.length > 0) {
      blocks.push({ type: 'text', content: currentTextLines.join('\n') })
    }

    return blocks
  }

  const formatText = (content) => {
    const blocks = parseMarkdownBlocks(content)

    return blocks.map((block, bIdx) => {
      if (block.type === 'code') {
        return (
          <CodeBlock
            key={`code-${bIdx}`}
            language={block.language}
            code={block.code}
            isIncomplete={block.isIncomplete}
          />
        )
      }

      const lines = block.content.split('\n')
      return lines.map((line, idx) => {
        const trimmed = line.trim()

        // Horizontal Rule (--- or ***)
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return <hr key={`${bIdx}-${idx}`} className="my-4 border-neutral-800" />
        }

        // Headers
        if (line.startsWith('# ')) {
          return (
            <h2 key={`${bIdx}-${idx}`} className="text-lg sm:text-xl font-bold text-white mt-4 mb-2 tracking-tight">
              {line.replace(/^#\s+/, '')}
            </h2>
          )
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={`${bIdx}-${idx}`} className="text-base sm:text-lg font-semibold text-white mt-3.5 mb-1.5 tracking-tight">
              {line.replace(/^##\s+/, '')}
            </h3>
          )
        }
        if (line.startsWith('### ')) {
          return (
            <h4 key={`${bIdx}-${idx}`} className="text-sm sm:text-base font-semibold text-emerald-400 mt-3 mb-1">
              {line.replace(/^###\s+/, '')}
            </h4>
          )
        }
        if (line.startsWith('#### ')) {
          return (
            <h5 key={`${bIdx}-${idx}`} className="text-xs sm:text-sm font-semibold text-neutral-300 mt-2 mb-1">
              {line.replace(/^####\s+/, '')}
            </h5>
          )
        }

        // Numbered list: 1. Item
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/)
        if (numberedMatch) {
          return (
            <div key={`${bIdx}-${idx}`} className="flex items-start gap-2 my-1 pl-1">
              <span className="text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0 mt-0.5">
                {numberedMatch[1]}
              </span>
              <div className="text-neutral-200 leading-relaxed text-sm md:text-base">
                {renderInlineMarkdown(numberedMatch[2])}
              </div>
            </div>
          )
        }

        // Bullet list: * Item or - Item
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const itemText = line.slice(2)
          return (
            <li key={`${bIdx}-${idx}`} className="ml-5 list-disc text-neutral-300 my-0.5 leading-relaxed text-sm md:text-base">
              {renderInlineMarkdown(itemText)}
            </li>
          )
        }

        // Blockquote: > Note
        if (line.startsWith('> ')) {
          return (
            <blockquote
              key={`${bIdx}-${idx}`}
              className="border-l-2 border-emerald-500 pl-3.5 my-2.5 text-xs sm:text-sm italic text-neutral-300 bg-emerald-950/20 py-1.5 rounded-r"
            >
              {renderInlineMarkdown(line.slice(2))}
            </blockquote>
          )
        }

        // Empty line
        if (trimmed === '') {
          return <div key={`${bIdx}-${idx}`} className="h-2" />
        }

        // Standard paragraph
        return (
          <p key={`${bIdx}-${idx}`} className="leading-relaxed text-neutral-200 my-1 text-sm md:text-base">
            {renderInlineMarkdown(line)}
          </p>
        )
      })
    })
  }

  return (
    <div
      className={`group w-full py-4 px-3 sm:px-6 transition-colors duration-150 ${
        isError
          ? 'bg-rose-950/20 border-y border-rose-900/50'
          : isAi
          ? 'bg-neutral-900/40 border-y border-neutral-800/40'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-3xl mx-auto flex items-start gap-3.5 sm:gap-4">
        {/* Avatar */}
        <div className="shrink-0 pt-0.5">
          {isError ? (
            <div className="h-8 w-8 rounded-xl bg-rose-600/30 border border-rose-500/50 flex items-center justify-center text-rose-300 shadow-sm">
              <AlertCircle className="h-4 w-4" />
            </div>
          ) : isAi ? (
            <div className="relative h-8 w-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white">
              <Sparkles className="h-4 w-4 animate-pulse" />
              {isStreaming && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
          ) : (
            <div className="h-8 w-8 rounded-xl bg-neutral-700 border border-neutral-600 flex items-center justify-center text-neutral-300 shadow-sm">
              <User className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Header (Author + Timestamp) */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold ${
                isError ? 'text-rose-400' : 'text-white'
              }`}
            >
              {isError ? 'System Notice' : isAi ? 'Bujju AI' : 'You'}
            </span>
            <span className="text-[11px] text-neutral-500">{message.timestamp}</span>
            {isStreaming && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                streaming
              </span>
            )}
          </div>

          {/* Body */}
          <div className="text-sm md:text-base text-neutral-200">
            {isError ? (
              <p className="text-rose-300 leading-relaxed">{message.text}</p>
            ) : isAi ? (
              <div className="space-y-1">
                {formatText(message.text)}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 align-middle bg-emerald-400 gemini-cursor-blink rounded-xs shadow-sm shadow-emerald-400/50" />
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-neutral-800/80">
                    <div className="text-[11px] font-semibold text-neutral-400 mb-1.5 flex items-center gap-1.5">
                      <span>🌐 Sources & Grounding</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {message.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-800/80 hover:bg-neutral-800 text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors border border-neutral-700/60"
                        >
                          <span className="truncate max-w-[200px]">{src.title || src.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                {message.text.split('\n').map((line, idx) => {
                  if (line.startsWith('[Image attached: ') && line.endsWith(']')) {
                    const imgName = line.slice(17, -1)
                    return (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/90 border border-neutral-700/80 text-xs text-neutral-300 mb-1"
                      >
                        <span className="text-sm">🖼️</span>
                        <span className="font-medium text-white">{imgName}</span>
                      </div>
                    )
                  }
                  return (
                    <p key={idx} className="whitespace-pre-wrap leading-relaxed text-neutral-200">
                      {line}
                    </p>
                  )
                })}
              </div>
            )}
          </div>

          {/* AI Action toolbar (speaker, copy, thumbs up/down, regenerate) */}
          {isAi && !isError && !isStreaming && (
            <div className="flex items-center gap-1.5 pt-2 text-neutral-400">
              {onToggleSpeak && (
                <button
                  type="button"
                  onClick={() => onToggleSpeak(message)}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                    isSpeaking
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                      : 'hover:bg-neutral-800 hover:text-neutral-200'
                  }`}
                  title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                  aria-label={isSpeaking ? 'Stop speaking' : 'Read aloud'}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                      <span className="text-[11px] font-medium text-emerald-400">Stop speaking</span>
                    </>
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-neutral-800 hover:text-neutral-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                title="Copy response"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400">Copied</span>
                  </>
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
                className={`p-1.5 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer ${
                  feedback === 'like'
                    ? 'text-emerald-400 bg-neutral-800'
                    : 'hover:text-neutral-200'
                }`}
                title="Good response"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
                className={`p-1.5 rounded-md hover:bg-neutral-800 transition-colors cursor-pointer ${
                  feedback === 'dislike'
                    ? 'text-rose-400 bg-neutral-800'
                    : 'hover:text-neutral-200'
                }`}
                title="Bad response"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="p-1.5 rounded-md hover:bg-neutral-800 hover:text-neutral-200 transition-colors cursor-pointer"
                  title="Regenerate response"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
