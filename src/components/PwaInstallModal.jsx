import { useEffect } from 'react'
import { X, Download, Share2, PlusSquare, Monitor, CheckCircle2, AlertCircle } from 'lucide-react'

export default function PwaInstallModal({
  isOpen,
  onClose,
  isInstallable,
  onInstallApp,
  isInstalled,
  installInfo = {},
}) {
  // Global Escape key listener
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const { isIos, isFirefox, isSafari, isChrome, isEdge } = installInfo

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div
        className="relative w-full max-w-md bg-[#1e1f20] border border-white/10 rounded-2xl shadow-2xl p-6 text-neutral-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4285f4] via-[#9b72cf] to-[#d96570]" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label="Close installation instructions"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4285f4]/20 to-[#9b72cf]/20 border border-[#4285f4]/30 flex items-center justify-center text-[#8ab4f8] shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 id="pwa-install-title" className="text-base font-semibold text-white">
              Install Bujju AI
            </h2>
            <p className="text-xs text-neutral-400">
              {isInstalled
                ? 'App is already installed on this device'
                : 'Fast access, fullscreen mode, and instant launch'}
            </p>
          </div>
        </div>

        {/* Content based on state & browser */}
        {isInstalled ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Bujju AI is Installed</p>
            <p className="text-xs text-neutral-400 mt-1">
              You are currently running Bujju AI in standalone mode.
            </p>
          </div>
        ) : isIos ? (
          /* iOS Safari Specific Instructions */
          <div className="space-y-3.5 text-xs text-neutral-300">
            <p className="text-[11px] text-neutral-400">
              Apple iOS requires adding web apps from Safari:
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131314] border border-white/5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4285f4]/20 text-[11px] font-semibold text-[#8ab4f8]">
                  1
                </span>
                <div>
                  <p className="font-medium text-white flex items-center gap-1.5">
                    Tap the Share button
                    <Share2 className="w-3.5 h-3.5 text-[#8ab4f8] inline" />
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Located in Safari's bottom toolbar on iPhone or top toolbar on iPad.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131314] border border-white/5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4285f4]/20 text-[11px] font-semibold text-[#8ab4f8]">
                  2
                </span>
                <div>
                  <p className="font-medium text-white flex items-center gap-1.5">
                    Select &quot;Add to Home Screen&quot;
                    <PlusSquare className="w-3.5 h-3.5 text-[#8ab4f8] inline" />
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Scroll down in the share sheet and tap &quot;Add to Home Screen&quot;.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#131314] border border-white/5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4285f4]/20 text-[11px] font-semibold text-[#8ab4f8]">
                  3
                </span>
                <div>
                  <p className="font-medium text-white">Tap &quot;Add&quot;</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Tap Add in the top right. Bujju AI will appear as an app on your Home Screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : isInstallable ? (
          /* Compatible Browser With Ready Prompt */
          <div className="space-y-3.5 text-xs text-neutral-300">
            <p className="text-neutral-300">
              Your browser supports one-click installation. Install Bujju AI to enjoy full screen, desktop shortcuts, and fast startup.
            </p>
            <div className="p-3 rounded-xl bg-[#131314] border border-[#4285f4]/20 flex items-center gap-3">
              <Monitor className="w-6 h-6 text-[#8ab4f8] shrink-0" />
              <div className="text-[11px] text-neutral-400">
                Installs directly into your operating system application menu.
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                const installed = await onInstallApp()
                if (installed) onClose()
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#4285f4] hover:bg-[#3b78e7] text-white font-medium text-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </button>
          </div>
        ) : isFirefox || isSafari ? (
          /* Browsers Without Native PWA Install */
          <div className="space-y-3 text-xs text-neutral-300">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                {isFirefox
                  ? 'Firefox desktop does not support native PWA installation.'
                  : 'Safari desktop has limited PWA installation support.'}
              </p>
            </div>
            <p className="text-neutral-400 text-[11px] leading-relaxed">
              For the best desktop app experience with standalone windows and dock/taskbar pinning, open Bujju AI in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Brave</strong>.
            </p>
            <div className="p-2.5 rounded-xl bg-[#131314] border border-white/5 text-[11px] text-neutral-400">
              💡 <strong>Tip:</strong> You can bookmark this page (<kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">Ctrl+D</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-[10px]">⌘+D</kbd>) for quick access.
            </div>
          </div>
        ) : (
          /* Generic Desktop / Mobile Browser Instructions */
          <div className="space-y-3 text-xs text-neutral-300">
            <p className="text-neutral-400 text-[11px]">
              To install Bujju AI from your browser:
            </p>
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-[#131314] border border-white/5 text-[11px]">
                <strong className="text-white block mb-0.5">Desktop ({isEdge ? 'Edge' : isChrome ? 'Chrome' : 'Browser'}):</strong>
                Look for the install icon <span className="inline-block px-1 rounded bg-white/10 font-mono text-[10px]">⊕</span> in the right side of the address bar, or click Menu (⋮) → &quot;Install Bujju AI&quot;.
              </div>
              <div className="p-2.5 rounded-xl bg-[#131314] border border-white/5 text-[11px]">
                <strong className="text-white block mb-0.5">Mobile Android:</strong>
                Tap the three-dot menu (⋮) in Chrome → tap &quot;Install app&quot; or &quot;Add to Home screen&quot;.
              </div>
            </div>
          </div>
        )}

        {/* Footer Button */}
        <div className="mt-5 pt-3 border-t border-white/5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            {isInstalled ? 'Close' : 'Got It'}
          </button>
        </div>
      </div>
    </div>
  )
}
