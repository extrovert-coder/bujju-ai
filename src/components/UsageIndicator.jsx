import { Zap, AlertTriangle, Clock } from 'lucide-react'

/**
 * UsageIndicator component displays user's real daily AI quota near the composer.
 * Strictly informational on the frontend; actual limit is enforced server-side.
 */
export default function UsageIndicator({
  usage,
  isLoading = false,
  error = null,
  className = '',
}) {
  // Format reset time into friendly local time string (e.g., "12:00 AM UTC" or local equivalent)
  const formatResetTime = (isoString) => {
    if (!isoString) return 'midnight'
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return 'midnight'
    }
  }

  // 1. Loading state: small subtle skeleton / placeholder
  if (isLoading && !usage) {
    return (
      <div
        className={`flex items-center gap-2 text-xs text-neutral-500 py-1 px-1.5 select-none animate-pulse ${className}`}
        aria-live="polite"
        aria-label="Checking daily AI usage..."
      >
        <Zap className="h-3 w-3 text-neutral-600" />
        <span className="text-[11px] font-mono">⚡ -- / --</span>
      </div>
    )
  }

  // 2. Error / Unavailable state: neutral, does not block chat or fabricate numbers
  if (error || !usage) {
    return (
      <div
        className={`flex items-center gap-1.5 text-[11px] text-neutral-500 py-1 px-1.5 select-none ${className}`}
        title="Could not retrieve usage quota from server"
      >
        <Zap className="h-3 w-3 text-neutral-600" />
        <span>⚡ Usage unavailable</span>
      </div>
    )
  }

  const { limit = 20, remaining = 0, resetAt } = usage
  const pct = limit > 0 ? Math.min(100, Math.max(0, (remaining / limit) * 100)) : 0
  const isExhausted = remaining <= 0
  const isLow = remaining > 0 && remaining <= 3
  const isMedium = remaining > 3 && remaining <= 6

  // Status-dependent colors
  let progressColor = 'bg-gradient-to-r from-[#4285f4] to-[#9b72cf]'
  let badgeColor = 'text-[#8ab4f8]'
  if (isExhausted) {
    progressColor = 'bg-rose-500'
    badgeColor = 'text-rose-400'
  } else if (isLow) {
    progressColor = 'bg-amber-500'
    badgeColor = 'text-amber-400'
  } else if (isMedium) {
    progressColor = 'bg-gradient-to-r from-blue-400 to-amber-400'
    badgeColor = 'text-sky-300'
  }

  // 3. Exhausted state banner
  if (isExhausted) {
    return (
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-xs text-rose-300 shadow-sm animate-fade-in ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center gap-1.5 font-medium min-w-0">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span className="truncate">Daily AI limit reached.</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-rose-300/80 shrink-0 font-normal">
          <Clock className="h-3 w-3" />
          <span>Resets at {formatResetTime(resetAt)}</span>
        </div>
      </div>
    )
  }

  // 4. Active quota state
  const accessibleLabel = `${remaining} of ${limit} AI messages remaining today`

  return (
    <div
      className={`flex items-center justify-between gap-2.5 px-1 py-1 text-xs select-none ${className}`}
      role="status"
      aria-label={accessibleLabel}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Zap className={`h-3.5 w-3.5 shrink-0 ${badgeColor}`} />
        <span className="text-[11px] font-medium text-neutral-300">
          <span className={`font-semibold font-mono ${badgeColor}`}>{remaining}</span>
          <span className="text-neutral-500 font-mono"> / {limit}</span>
          <span className="text-neutral-400 ml-1 hidden xs:inline sm:inline">left</span>
        </span>
      </div>

      {/* Subtle Progress Bar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 sm:w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {isLow && (
          <span className="text-[10px] text-amber-400 font-medium hidden sm:inline">
            Low
          </span>
        )}
      </div>
    </div>
  )
}
