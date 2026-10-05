import { Compass, Code, Lightbulb, PenTool } from 'lucide-react'

const GEMINI_SUGGESTIONS = [
  {
    title: 'Code & Debug',
    description: 'Write a responsive modern navbar with Tailwind CSS',
    icon: Code,
  },
  {
    title: 'Brainstorm Ideas',
    description: 'Suggest 5 creative startup ideas leveraging AI agents',
    icon: Lightbulb,
  },
  {
    title: 'Explore & Learn',
    description: 'Explain quantum computing in simple everyday analogies',
    icon: Compass,
  },
  {
    title: 'Draft & Write',
    description: 'Draft a polite follow-up email after a job interview',
    icon: PenTool,
  },
]

export default function WelcomeScreen({ onSelectSuggestion, user }) {
  const displayName =
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'there'

  return (
    <div className="flex-1 flex flex-col items-start justify-center px-4 sm:px-12 py-10 max-w-4xl mx-auto w-full my-auto animate-fade-in">
      {/* Gemini Headline */}
      <div className="space-y-1 mb-10">
        <h1 className="text-4xl sm:text-6xl font-medium tracking-tight">
          <span className="gemini-gradient-text font-semibold">Hello, {displayName}</span>
        </h1>
        <h2 className="text-3xl sm:text-5xl font-medium text-[#444746] tracking-tight">
          How can I help you today?
        </h2>
      </div>

      {/* Suggestion Cards Grid (Gemini Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
        {GEMINI_SUGGESTIONS.map((item, index) => {
          const Icon = item.icon
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectSuggestion(item.description)}
              className="group relative p-4.5 rounded-2xl bg-[#1e1f20] hover:bg-[#282a2c] border border-white/5 hover:border-neutral-700/60 transition-all duration-200 h-44 flex flex-col justify-between text-left cursor-pointer shadow-sm hover:shadow-md"
            >
              <p className="text-sm font-normal text-[#c4c7c5] group-hover:text-white leading-relaxed line-clamp-3">
                {item.description}
              </p>

              <div className="self-end h-9 w-9 rounded-full bg-[#131314] group-hover:bg-[#333538] flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors border border-white/5">
                <Icon className="h-4 w-4" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
