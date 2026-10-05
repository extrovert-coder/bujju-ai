import { useId } from 'react'

// Custom Bujju AI Signature Logo & Icon Component
// Combines the "B" monogram with the iconic Google Gemini 4-point celestial starburst

export function BujjuIcon({
  size = 32,
  className = '',
  animated = false,
  glow = true,
}) {
  const pixelSize = typeof size === 'number' ? size : 32
  const rawId = useId()
  const uniqueId = `bujju-logo-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className} ${
        animated ? 'hover:scale-105 transition-transform duration-200' : ''
      }`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      {/* Optional ambient aurora blur glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#4285f4]/40 via-[#9b72cf]/35 to-[#d96570]/40 blur-md pointer-events-none transform scale-110 -z-10"
          style={{ opacity: animated ? 0.9 : 0.6 }}
        />
      )}

      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full select-none overflow-visible"
      >
        <defs>
          {/* Main Gemini Iridescent Gradient */}
          <linearGradient id={`${uniqueId}-grad-primary`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="42%" stopColor="#9B72CF" />
            <stop offset="78%" stopColor="#D96570" />
            <stop offset="100%" stopColor="#FF7A59" />
          </linearGradient>

          {/* Accent Blue/Cyan Gradient */}
          <linearGradient id={`${uniqueId}-grad-cyan`} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1A73E8" />
            <stop offset="100%" stopColor="#4DD0E1" />
          </linearGradient>

          {/* Sparkle White Glow */}
          <linearGradient id={`${uniqueId}-grad-sparkle`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="50%" stopColor="#D4E4FF" />
            <stop offset="100%" stopColor="#9B72CF" />
          </linearGradient>

          {/* Subtle Dark Inset Surface */}
          <linearGradient id={`${uniqueId}-bg-surface`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E2024" />
            <stop offset="100%" stopColor="#131416" />
          </linearGradient>
        </defs>

        {/* Base Squircle Container */}
        <rect
          x="4"
          y="4"
          width="92"
          height="92"
          rx="26"
          fill={`url(#${uniqueId}-bg-surface)`}
          stroke={`url(#${uniqueId}-grad-primary)`}
          strokeWidth="2.5"
          strokeOpacity="0.4"
        />

        {/* Stylized "B" Monogram Backbone & Loops */}
        {/* Vertical Left Stem */}
        <path
          d="M28 24C28 21.7909 29.7909 20 32 20H37C39.2091 20 41 21.7909 41 24V76C41 78.2091 39.2091 80 37 80H32C29.7909 80 28 78.2091 28 76V24Z"
          fill={`url(#${uniqueId}-grad-primary)`}
        />

        {/* Top Loop of "B" */}
        <path
          d="M38 20H51C61 20 67 26 67 35C67 43 61 48 50 49H38V38H49C54 38 56.5 36.5 56.5 34.5C56.5 32.5 54 31 49 31H38V20Z"
          fill={`url(#${uniqueId}-grad-primary)`}
        />

        {/* Bottom Loop of "B" */}
        <path
          d="M38 47H54C65 47 72 53 72 63.5C72 74 64 80 52 80H38V69H51C57 69 60.5 66.5 60.5 63.5C60.5 60.5 57 58 51 58H38V47Z"
          fill={`url(#${uniqueId}-grad-primary)`}
        />

        {/* The Gemini Celestial 4-Point Starburst (Upper Right Apex) */}
        <g transform="translate(68, 24)">
          {/* Outer Pulsing Star Rays */}
          <path
            d="M0 -15 C0 -5 5 0 15 0 C5 0 0 5 0 15 C0 5 -5 0 -15 0 C-5 0 0 -5 0 -15 Z"
            fill={`url(#${uniqueId}-grad-sparkle)`}
          />
          {/* Inner Brilliant Core */}
          <circle cx="0" cy="0" r="3" fill="#FFFFFF" />
        </g>

        {/* Secondary Micro-Sparkle (Lower Left) */}
        <g transform="translate(24, 76)">
          <path
            d="M0 -6 C0 -2 2 0 6 0 C2 0 0 2 0 6 C0 2 -2 0 -6 0 C-2 0 0 -2 0 -6 Z"
            fill={`url(#${uniqueId}-grad-sparkle)`}
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  )
}

export default function BujjuLogo({
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  showText = true,
  subtitle,
  className = '',
  animated = false,
}) {
  const sizeMap = {
    sm: { icon: 26, text: 'text-base', sub: 'text-[10px]' },
    md: { icon: 34, text: 'text-lg', sub: 'text-[11px]' },
    lg: { icon: 46, text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 58, text: 'text-3xl', sub: 'text-sm' },
  }

  const currentSize = sizeMap[size] || sizeMap.md

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Monogram Icon */}
      <BujjuIcon size={currentSize.icon} animated={animated} />

      {/* Brand Wordmark */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-1.5 font-bold tracking-tight">
            <span className="text-white font-semibold">Bujju</span>
            <span className="gemini-gradient-text font-black px-1 py-0.5 rounded-md text-xs sm:text-sm tracking-wide">
              AI
            </span>
          </div>

          {subtitle && (
            <span className={`text-[#8ab4f8] font-medium tracking-tight ${currentSize.sub}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
