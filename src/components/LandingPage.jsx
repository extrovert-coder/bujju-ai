import { useRef } from 'react'
import {
  MessageSquare,
  FileText,
  Image,
  Globe,
  Mic,
  Brain,
  ArrowRight,
  LogIn,
  Sparkles,
  CheckCircle2,
  Send,
  Paperclip,
} from 'lucide-react'
import WelcomeAnimation from './WelcomeAnimation'
import { BujjuIcon } from './BujjuLogo'

const CURRENT_YEAR = new Date().getFullYear()

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'AI Chat',
    description: 'Have natural conversations and get help with questions, ideas and tasks.',
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-400 border-blue-500/30',
  },
  {
    icon: FileText,
    title: 'PDF Understanding',
    description: 'Upload a PDF and ask questions about its content.',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: Image,
    title: 'Image Understanding',
    description: 'Upload images and let Bujju AI analyze and explain them.',
    color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
  },
  {
    icon: Globe,
    title: 'Web Search',
    description: 'Search the web and get answers based on current information.',
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
  },
  {
    icon: Mic,
    title: 'Voice',
    description: 'Talk to Bujju AI using voice and listen to responses.',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  },
  {
    icon: Brain,
    title: 'Smart Assistance',
    description: 'Get help with studying, coding, writing, planning and everyday tasks.',
    color: 'from-rose-500/20 to-purple-500/20 text-rose-400 border-rose-500/30',
  },
]

const STEPS = [
  {
    step: '01',
    title: 'Ask',
    description: 'Ask Bujju AI anything.',
  },
  {
    step: '02',
    title: 'Explore',
    description: 'Upload files, images or search the web when needed.',
  },
  {
    step: '03',
    title: 'Get help',
    description: 'Receive an intelligent response and continue the conversation.',
  },
]

export default function LandingPage({ onLogin, onGetStarted }) {
  const overviewRef = useRef(null)

  const scrollToOverview = () => {
    if (overviewRef.current) {
      overviewRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="h-screen w-screen overflow-y-auto bg-[#131314] text-[#e3e3e3] font-sans antialiased selection:bg-[#4285f4]/30 selection:text-white">
      {/* ---------------------------------------------------- */}
      {/* Sticky Responsive Header */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#131314]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo brand */}
          <div className="flex items-center gap-2.5">
            <BujjuIcon size={34} animated={true} glow={false} />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-white">
                Bujju AI
              </span>
              <span className="text-[10px] text-[#8ab4f8] font-medium hidden sm:inline">
                Intelligent Assistant
              </span>
            </div>
          </div>

          {/* Navigation Links & Auth Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={scrollToOverview}
              className="hidden md:inline-flex text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-full hover:bg-white/5"
            >
              Overview
            </button>

            <button
              type="button"
              onClick={onLogin}
              className="min-h-[44px] px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4285f4] flex items-center gap-1.5"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Login</span>
            </button>

            <button
              type="button"
              onClick={onGetStarted}
              className="min-h-[44px] px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition-all cursor-pointer shadow-sm hover:shadow focus:outline-none focus:ring-2 focus:ring-white/80"
            >
              <span>Get Started</span>
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* 1. Animated Welcome Hero Section */}
      {/* ---------------------------------------------------- */}
      <WelcomeAnimation
        onExplore={scrollToOverview}
        onLogin={onLogin}
        onGetStarted={onGetStarted}
      />

      {/* ---------------------------------------------------- */}
      {/* 2. Overview Section: Capabilities */}
      {/* ---------------------------------------------------- */}
      <section
        ref={overviewRef}
        id="overview"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5 scroll-mt-16"
        aria-labelledby="overview-title"
      >
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#4285f4]/10 border border-[#4285f4]/25 text-xs text-[#8ab4f8] font-medium mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Core Capabilities</span>
          </div>
          <h2 id="overview-title" className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Everything you need in one AI assistant
          </h2>
          <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
            Ask questions, understand documents, analyze images, search the web and interact naturally with AI.
          </p>
        </div>

        {/* Feature Cards Grid (2 cols mobile, 3 cols desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon
            return (
              <div
                key={idx}
                className="group relative p-6 rounded-2xl bg-[#1e1f20]/75 hover:bg-[#282a2c] border border-white/5 hover:border-white/10 transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md"
              >
                <div>
                  <div className={`h-11 w-11 rounded-xl bg-gradient-to-tr ${feat.color} border flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">
                    {feat.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 3. How It Works (Simple 3 Steps) */}
      {/* ---------------------------------------------------- */}
      <section
        className="max-w-6xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5"
        aria-labelledby="how-it-works-title"
      >
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 id="how-it-works-title" className="text-2xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-neutral-400">
            Getting high-quality AI assistance in 3 simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className="relative p-6 sm:p-7 rounded-2xl bg-[#1e1f20]/50 border border-white/5 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-mono font-bold gemini-gradient-text">
                  {step.step}
                </span>
                <CheckCircle2 className="h-4 w-4 text-[#8ab4f8]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">
                  {step.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 4. Interactive Chat Interface Preview (Static Mock) */}
      {/* ---------------------------------------------------- */}
      <section
        className="max-w-4xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5"
        aria-labelledby="preview-title"
      >
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 id="preview-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Designed for Clarity and Speed
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Clean Google Gemini-caliber design with dark mode, markdown formatting, and real-time response.
          </p>
        </div>

        {/* Visual Mock Chat Frame */}
        <div className="rounded-3xl border border-white/10 bg-[#1e1f20]/90 shadow-2xl overflow-hidden p-4 sm:p-6 space-y-4">
          {/* Mock Top bar */}
          <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="font-medium text-neutral-300">Bujju AI Chat Preview</span>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">Gemini Intelligence</span>
          </div>

          {/* User Mock Message */}
          <div className="flex justify-end">
            <div className="max-w-md px-4 py-3 rounded-2xl rounded-br-xs bg-[#282a2c] text-white text-xs sm:text-sm shadow-xs">
              <p>Help me understand this topic.</p>
            </div>
          </div>

          {/* AI Mock Message */}
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-[#4285f4] to-[#9b72cf] flex items-center justify-center shrink-0 text-white mt-1">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 space-y-2.5 max-w-lg">
              <div className="text-xs font-semibold text-neutral-300">Bujju AI</div>
              <div className="p-4 rounded-2xl bg-[#131314] border border-white/5 text-xs sm:text-sm text-neutral-300 space-y-2 leading-relaxed">
                <p>
                  Of course! Let's break it down step by step:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-neutral-400 text-xs">
                  <li><strong className="text-neutral-200">Core Principle:</strong> Identify foundational concepts before diving into complexity.</li>
                  <li><strong className="text-neutral-200">Real-World Analogy:</strong> Think of it as modular building blocks fitting together.</li>
                  <li><strong className="text-neutral-200">Practical Application:</strong> Apply with automated testing and iterative feedback.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mock Capsule Input */}
          <div className="pt-2">
            <div className="rounded-2xl bg-[#131314] border border-white/10 px-4 py-2.5 flex items-center justify-between opacity-80 pointer-events-none">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Ask Bujju AI anything...</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
                  <Mic className="h-3 w-3" />
                </div>
                <div className="h-6 w-6 rounded-full bg-white text-black flex items-center justify-center">
                  <Send className="h-3 w-3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 5. Final Call To Action Section */}
      {/* ---------------------------------------------------- */}
      <section
        className="max-w-5xl mx-auto px-4 sm:px-6 py-20 border-t border-white/5 text-center"
        aria-labelledby="cta-title"
      >
        <div className="relative p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-[#1e1f20] to-[#17181a] border border-white/10 overflow-hidden shadow-2xl">
          {/* Subtle background ambient blur */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#4285f4]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-[#8ab4f8] font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Get started for free</span>
            </div>

            <h2 id="cta-title" className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
              Ready to try Bujju AI?
            </h2>

            <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
              Start chatting, exploring knowledge, and analyzing documents in seconds.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={onGetStarted}
                className="w-full sm:w-auto min-h-[44px] px-8 py-3.5 rounded-full bg-white text-black hover:bg-neutral-200 font-semibold text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onLogin}
                className="w-full sm:w-auto min-h-[44px] px-7 py-3.5 rounded-full bg-[#282a2c] hover:bg-[#333538] text-white border border-white/10 font-medium text-sm inline-flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4285f4]"
              >
                <LogIn className="h-4 w-4 text-neutral-400" />
                <span>Login</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* Footer */}
      {/* ---------------------------------------------------- */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BujjuIcon size={20} animated={false} glow={false} />
            <span className="font-medium text-neutral-400">Bujju AI</span>
            <span>— Intelligent Assistant</span>
          </div>
          <p>© {CURRENT_YEAR} Bujju AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
