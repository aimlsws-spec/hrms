import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { getRoleHome } from '../hooks/useRoleRedirect'
import AuthLayout from '../components/auth/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import ErrorAlert from '../components/ui/ErrorAlert'

type Step = 'credentials' | 'otp'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const [step, setStep]               = useState<Step>('credentials')
  const [username, setUsername]       = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp]                 = useState('')
  const [otpHint, setOtpHint]         = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState('')
  const [successMsg, setSuccessMsg]   = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start 60-second countdown when OTP step opens
  useEffect(() => {
    if (step !== 'otp') return
    startCountdown()
    return () => stopCountdown()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  function startCountdown() {
    stopCountdown()
    setResendSeconds(60)
    timerRef.current = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) { stopCountdown(); return 0 }
        return s - 1
      })
    }, 1000)
  }

  function stopCountdown() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function clearMessages() { setError(''); setSuccessMsg('') }

  // ── Step 1: submit credentials ──────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      const { data } = await authApi.login({ username: username.trim(), password })
      if (data.success && data.requires_otp) {
        setOtpHint(data.otp ?? '')
        setSuccessMsg(data.message || 'OTP generated successfully.')
        setStep('otp')
      } else {
        setError(data.message || 'Login failed. Please check your credentials.')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: verify OTP ─────────────────────────────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
    setIsLoading(true)
    try {
      const { data } = await authApi.verifyOtp({ username: username.trim(), otp })
      if (data.success && data.user && data.token) {
        const roleHome = getRoleHome(data.user.role)
        setUser({
          user_id:   data.user.user_id,
          username:  data.user.username,
          email:     data.user.email,
          full_name: data.user.full_name,
          role:      data.user.role,
          token:     data.token,
        })
        setSuccessMsg('Login successful!')
        setTimeout(() => navigate(roleHome, { replace: true }), 600)
      } else {
        setError(data.message || 'OTP verification failed.')
      }
    } catch {
      setError('Connection failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Resend OTP ─────────────────────────────────────────────────────────
  async function handleResendOtp() {
    if (resendSeconds > 0 || isLoading) return
    clearMessages()
    setIsLoading(true)
    try {
      const { data } = await authApi.login({ username: username.trim(), password })
      if (data.success && data.requires_otp) {
        setOtpHint(data.otp ?? '')
        setSuccessMsg(data.message || 'New OTP generated.')
        startCountdown()
      } else {
        setError(data.message || 'Failed to resend OTP.')
      }
    } catch {
      setError('Connection failed.')
    } finally {
      setIsLoading(false)
    }
  }

  function goBack() {
    setStep('credentials')
    setOtp('')
    clearMessages()
    stopCountdown()
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <AuthLayout>
      {/* Mobile-only brand logo */}
      <div className="md:hidden flex justify-center mb-6">
        <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center max-w-[170px]">
          <img
            src="/seawind-logo.png"
            alt="SeaWind"
            className="w-full h-auto object-contain"
          />
        </div>
      </div>

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-2xl font-extrabold text-primary-900 mb-2">
          {step === 'credentials' ? 'Welcome Back' : 'Verify OTP'}
        </h1>
        <p className="text-sm text-gray-500">
          {step === 'credentials'
            ? 'Sign in to access your HRMS portal'
            : 'Enter the code sent to your email'}
        </p>
      </div>

      {/* Alerts */}
      {error      && <ErrorAlert type="error"   message={error} />}
      {successMsg && <ErrorAlert type="success" message={successMsg} />}

      {/* ── Credentials form ── */}
      {step === 'credentials' && (
        <form onSubmit={handleLogin} noValidate>
          <Input
            label="Username"
            icon={<i className="fas fa-user text-base" />}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />
          <Input
            label="Password"
            icon={<i className="fas fa-lock text-base" />}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
              </button>
            }
          />
          <Button type="submit" loading={isLoading}>
            <i className="fas fa-sign-in-alt" /> Sign In
          </Button>

          <p className="mt-6 text-center text-xs text-gray-400">
            Accounts are assigned by HR. Contact your HR administrator for access.
          </p>
        </form>
      )}

      {/* ── OTP form ── */}
      {step === 'otp' && (
        <form onSubmit={handleVerifyOtp} noValidate>
          <div className="mb-5">
            <label className="block mb-2 text-sm font-semibold text-gray-700">
              Enter 6-digit OTP
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <i className="fas fa-key text-base" />
              </span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                required
                autoFocus
                className="w-full h-[52px] pl-12 pr-4 border-2 border-gray-200 rounded-xl bg-slate-50 text-gray-900 transition-all focus:outline-none focus:border-primary-700 focus:bg-white focus:shadow-[0_0_0_4px_rgba(30,64,175,0.1)] tracking-[0.4em] text-center font-mono text-xl"
              />
            </div>

            {/* Dev/demo OTP hint */}
            {otpHint && (
              <p className="mt-2 text-xs text-primary-700">
                <i className="fas fa-info-circle mr-1" />
                OTP: <span className="font-semibold">{otpHint}</span>
              </p>
            )}

            {/* Timer / resend */}
            <div className="mt-1.5 text-right">
              {resendSeconds > 0 ? (
                <span className="text-xs text-gray-500">
                  Resend OTP in 00:{String(resendSeconds).padStart(2, '0')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-xs text-primary-700 underline hover:text-primary-800 disabled:opacity-50"
                >
                  Resend OTP
                </button>
              )}
            </div>
          </div>

          <Button type="submit" loading={isLoading}>
            <i className="fas fa-key" /> Verify OTP
          </Button>

          <button
            type="button"
            onClick={goBack}
            className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 transition-colors text-center"
          >
            ← Back to login
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
