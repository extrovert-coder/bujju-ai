import { useState, useEffect } from 'react'
import { BujjuIcon } from './BujjuLogo'

const SPLASH_SESSION_KEY = 'bujju_ai_splash_seen'

export default function SplashScreen({ onFinish }) {
  // Check for reduced motion preference
  const isReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const [stage, setStage] = useState(() => (isReducedMotion ? 5 : 0))
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    // Check if splash was already shown in this browser session (new tab check)
    try {
      const alreadySeen = sessionStorage.getItem(SPLASH_SESSION_KEY)
      if (alreadySeen) {
        onFinish?.()
        return
      }
    } catch {
      // If sessionStorage is unavailable in edge case, proceed normally
    }

    if (isReducedMotion) {
      // Show content immediately and transition quickly
      const timer = setTimeout(() => {
        setIsFadingOut(true)
        setTimeout(() => {
          try {
            sessionStorage.setItem(SPLASH_SESSION_KEY, 'true')
          } catch { }
          onFinish?.()
        }, 200)
      }, 500)
      return () => clearTimeout(timer)
    }

    // Premium sequenced choreography (GPU-friendly transform & opacity)
    // 0.0s - dark background appears (stage 0)
    // 0.15s - logo scales & fades in (stage 1)
    const t1 = setTimeout(() => setStage(1), 150)
    // 0.35s - subtle logo glow/pulse (stage 2)
    const t2 = setTimeout(() => setStage(2), 350)
    // 0.55s - "Bujju AI" fades upward (stage 3)
    const t3 = setTimeout(() => setStage(3), 550)
    // 0.80s - Tagline fades upward (stage 4)
    const t4 = setTimeout(() => setStage(4), 800)
    // 1.10s - Subtle AI-inspired animated element appears (stage 5)
    const t5 = setTimeout(() => setStage(5), 1100)
    // 1.55s - Begin smooth transition into the application (stage 6)
    const t6 = setTimeout(() => {
      setIsFadingOut(true)
    }, 1550)
    // 1.85s - Complete splash and unmount
    const t7 = setTimeout(() => {
      try {
        sessionStorage.setItem(SPLASH_SESSION_KEY, 'true')
      } catch { }
      onFinish?.()
    }, 1850)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
      clearTimeout(t6)
      clearTimeout(t7)
    }
  }, [onFinish, isReducedMotion])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#131314] select-none transition-opacity duration-300 ease-out ${isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading Bujju AI"
    >
      {/* Background ambient radial gradient */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 transition-opacity duration-1000"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(66, 133, 244, 0.12) 0%, rgba(155, 114, 207, 0.08) 35%, rgba(19, 19, 20, 0) 70%)',
        }}
      />

      <div className="relative flex flex-col items-center text-center px-4 max-w-sm sm:max-w-md w-full">
        {/* Bujju AI Monogram Logo with Celestial Starburst */}
        <div className="relative flex items-center justify-center mb-5 sm:mb-6">
          {/* Subtle orbiting AI ring element (appears at stage 5) */}
          <div
            className={`absolute -inset-3.5 sm:-inset-4 rounded-full border border-[#4285f4]/20 border-t-[#9b72cf]/60 pointer-events-none transition-all duration-700 ${stage >= 5
                ? 'opacity-100 scale-100 animate-spin'
                : 'opacity-0 scale-90'
              }`}
            style={{ animationDuration: '4s' }}
          />

          {/* Secondary soft concentric pulse ring */}
          <div
            className={`absolute -inset-1.5 sm:-inset-2 rounded-full border border-white/5 pointer-events-none transition-all duration-500 ${stage >= 2 ? 'opacity-80 scale-100' : 'opacity-0 scale-95'
              }`}
          />

          {/* Logo container with scale and fade */}
          <div
            className={`transform transition-all duration-500 ease-out ${stage >= 1
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-90 translate-y-2'
              }`}
          >
            <BujjuIcon
              size={64}
              glow={stage >= 2}
              animated={stage >= 2}
              className="drop-shadow-2xl"
            />
          </div>
        </div>

        {/* Brand Title: Bujju AI */}
        <div
          className={`flex items-center justify-center gap-2 transform transition-all duration-500 ease-out ${stage >= 3
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-3'
            }`}
        >
          <span className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Bujju
          </span>
          <span className="gemini-gradient-text text-2xl sm:text-3xl font-extrabold tracking-wide">
            AI
          </span>
        </div>

        {/* Tagline */}
        <p
          className={`mt-2 text-xs sm:text-sm text-[#8e918f] font-normal tracking-normal max-w-xs transform transition-all duration-500 ease-out ${stage >= 4
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
            }`}
        >
          Your intelligent AI assistant.
        </p>

        {/* Optional small slogan & subtle gradient bar */}
        <div
          className={`mt-4 flex flex-col items-center gap-2.5 transform transition-all duration-500 ease-out ${stage >= 5
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2'
            }`}
        >
          <div className="h-0.5 w-16 sm:w-20 rounded-full bg-gradient-to-r from-transparent via-[#4285f4]/60 to-transparent" />
          <span className="text-[11px] text-neutral-500 tracking-wider font-medium uppercase">
            Think. Create. Explore.
          </span>
        </div>
      </div>
    </div>
  )
}
