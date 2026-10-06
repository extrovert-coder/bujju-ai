import { useState, useRef } from 'react'
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import BujjuLogo from './BujjuLogo'

export default function AuthPage({ onLogin, onSignup, initialMode = 'login', onBack }) {
  const [mode, setMode] = useState(initialMode) // 'login' | 'signup'
  const isSubmittingRef = useRef(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const validateForm = () => {
    setError('')
    setSuccessMsg('')

    if (!email.trim()) {
      setError('Please enter your email address.')
      return false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.')
      return false
    }

    if (!password) {
      setError('Please enter your password.')
      return false
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your name.')
        return false
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.')
        return false
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify.')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmittingRef.current || loading) return
    if (!validateForm()) return

    isSubmittingRef.current = true
    setLoading(true)
    setError('')
    setSuccessMsg('')

    try {
      if (mode === 'login') {
        const result = await onLogin(email.trim(), password)
        if (!result.success) {
          setError(result.error || 'Invalid email or password.')
        }
      } else {
        const result = await onSignup(name.trim(), email.trim(), password)
        if (!result.success) {
          setError(result.error || 'Failed to create account. Please try again.')
        } else if (result.requiresConfirmation) {
          setSuccessMsg('Account created! Please check your email to verify your account or proceed to login.')
          setMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (err) {
      const errMsg = err.message || ''
      if (
        err.code === 'over_email_send_rate_limit' ||
        errMsg.includes('over_email_send_rate_limit') ||
        errMsg.toLowerCase().includes('rate limit')
      ) {
        setError('Email sending limit reached. Please try again later.')
      } else {
        setError(errMsg || 'An unexpected error occurred. Please try again.')
      }
    } finally {
      isSubmittingRef.current = false
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
    setError('')
    setSuccessMsg('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen w-screen bg-[#131314] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden select-none">
      {/* Background Gemini glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#4285f4]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-[#9b72cf]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Auth Card */}
      <div className="w-full max-w-md bg-[#1e1f20]/95 border border-white/5 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded-full hover:bg-white/5 border border-white/5 focus:outline-none focus:ring-2 focus:ring-[#4285f4]"
            aria-label="Back to Bujju AI Overview"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Overview</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-3">
            <BujjuLogo size="xl" animated={true} />
          </div>
          <p className="text-sm text-neutral-400 mt-1.5">
            {mode === 'login'
              ? 'Sign in to access your saved conversations'
              : 'Create your account to start chatting with Bujju AI'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs sm:text-sm animate-fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs sm:text-sm animate-fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <p className="leading-relaxed">{successMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-neutral-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Smith"
                  className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-neutral-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
              Password
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-neutral-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-xl pl-10 pr-11 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 p-1 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5 ml-1">
                Confirm Password
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 pointer-events-none text-neutral-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 rounded-xl pl-10 pr-11 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 p-1 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? 'Login' : 'Create Account'}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle Link */}
        <div className="mt-6 pt-5 border-t border-neutral-800/80 text-center">
          {mode === 'login' ? (
            <p className="text-xs sm:text-sm text-neutral-400">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-neutral-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                Login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
