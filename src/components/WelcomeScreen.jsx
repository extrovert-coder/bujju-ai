import { BujjuIcon } from './BujjuLogo'

export default function WelcomeScreen({ user }) {
  const displayName =
    user?.user_metadata?.name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    'there'

  return (
    <div className="flex-1 flex flex-col items-start justify-center px-4 sm:px-12 py-10 max-w-4xl mx-auto w-full my-auto animate-fade-in">
      {/* Bujju AI Emblem & Badge */}
      <div className="mb-6 flex items-center gap-3">
        <BujjuIcon size={48} animated={true} glow={true} />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white tracking-wider uppercase">
            Bujju AI
          </span>
          <span className="text-[11px] text-[#8ab4f8] font-medium">
            Powered by Gemini Intelligence
          </span>
        </div>
      </div>

      {/* Gemini Headline */}
      <div className="space-y-1">
        <h1 className="text-4xl sm:text-6xl font-medium tracking-tight">
          <span className="gemini-gradient-text font-semibold">Hello, {displayName}</span>
        </h1>
        <h2 className="text-3xl sm:text-5xl font-medium text-[#444746] tracking-tight">
          How can I help you today?
        </h2>
      </div>
    </div>
  )
}
