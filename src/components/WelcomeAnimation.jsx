import { useState, useEffect } from 'react'
import { ArrowRight, Sparkles, LogIn, ChevronDown } from 'lucide-react'
import { BujjuIcon } from './BujjuLogo'

export default function WelcomeAnimation({ onExplore, onLogin, onGetStarted }) {
  const [stage, setStage] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return 6
    }
    return 0
  })

  useEffect(() => {
    if (stage === 6) return

    // Sequence timing (in ms)
    const timers = [
      setTimeout(() => setStage(1), 200),  // 0.2s: Logo fades in
      setTimeout(() => setStage(2), 500),  // 0.5s: Logo subtle scale
      setTimeout(() => setStage(3), 800),  // 0.8s: "Bujju AI" title
      setTimeout(() => setStage(4), 1100), // 1.1s: Tagline
      setTimeout(() => setStage(5), 1500), // 1.5s: Supporting text
      setTimeout(() => setStage(6), 2000), // 2.0s: CTAs
    ]

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [stage])

  return (
    <section
      className="relative min-h-[92vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 py-12 select-none overflow-hidden"
      aria-label="Welcome to Bujju AI"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] h-[340px] sm:h-[500px] bg-[#4285f4]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[280px] sm:w-[420px] h-[280px] sm:h-[420px] bg-[#9b72cf]/12 rounded-full blur-3xl pointer-events-none" />

      {/* Skip Intro Button */}
      {stage < 6 && (
        <button
          type="button"
          onClick={onExplore}
          className="absolute top-6 right-6 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-full border border-white/5 bg-[#1e1f20]/60 hover:bg-[#282a2c] focus:outline-none focus:ring-2 focus:ring-[#4285f4]"
          aria-label="Skip welcome animation"
        >
          Skip Intro
        </button>
      )}

      {/* Center Welcome Container */}
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
        {/* Logo (0.2s fade, 0.5s scale) */}
        <div
          className={`transition-all duration-700 ease-out mb-6 ${
            stage >= 1 ? 'opacity-100' : 'opacity-0'
          } ${stage >= 2 ? 'scale-100 animate-bujju-float' : 'scale-90'}`}
        >
          <BujjuIcon size={76} animated={true} glow={true} />
        </div>

        {/* Brand Name (0.8s) */}
        <div
          className={`transition-all duration-500 ease-out ${
            stage >= 3
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#8ab4f8] font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5 text-[#8ab4f8]" />
            <span>Introducing Bujju AI</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white mb-2">
            <span className="gemini-gradient-text">Bujju AI</span>
          </h1>
        </div>

        {/* Tagline (1.1s) */}
        <p
          className={`text-xl sm:text-2xl md:text-3xl font-medium text-neutral-200 tracking-tight transition-all duration-500 ease-out mt-1 mb-3 ${
            stage >= 4
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          Your intelligent AI assistant.
        </p>

        {/* Short Supporting Text (1.5s) */}
        <p
          className={`text-sm sm:text-base text-neutral-400 max-w-lg leading-relaxed transition-all duration-500 ease-out mb-8 ${
            stage >= 5
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
        >
          Chat, create, understand, search and explore — all in one place.
        </p>

        {/* CTAs (2.0s) */}
        <div
          className={`flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto transition-all duration-500 ease-out ${
            stage >= 6
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={onExplore}
            className="w-full sm:w-auto min-h-[44px] px-7 py-3 rounded-full bg-white text-black hover:bg-neutral-200 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/80 active:scale-98"
          >
            <span>Explore Bujju AI</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onLogin}
            className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full bg-[#1e1f20] hover:bg-[#282a2c] text-white border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4285f4] active:scale-98"
          >
            <LogIn className="h-4 w-4 text-neutral-400" />
            <span>Login</span>
          </button>
        </div>

        {/* Subtext CTA */}
        {stage >= 6 && (
          <div className="mt-4 animate-bujju-fade">
            <button
              type="button"
              onClick={onGetStarted}
              className="text-xs text-neutral-400 hover:text-[#8ab4f8] transition-colors cursor-pointer py-1 underline-offset-4 hover:underline"
            >
              Don't have an account? Create free account →
            </button>
          </div>
        )}

        {/* Scroll indicator if completed */}
        {stage >= 6 && (
          <button
            type="button"
            onClick={onExplore}
            className="mt-10 inline-flex flex-col items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
            aria-label="Scroll to overview"
          >
            <span>Scroll to learn more</span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </button>
        )}
      </div>
    </section>
  )
}
