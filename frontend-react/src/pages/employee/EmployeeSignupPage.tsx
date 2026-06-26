import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../../components/auth/AuthLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import ErrorAlert from '../../components/ui/ErrorAlert'
import { authApi } from '../../api/auth'

type WorkMode = 'WFO' | 'WFH' | ''

interface SignupForm {
  full_name: string
  username: string
  email: string
  password: string
  confirmPassword: string
  phone: string
  department: string
}

const EMPTY: SignupForm = {
  full_name: '',
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  department: '',
}

function validate(form: SignupForm, workMode: WorkMode, enrollId: string): string {
  if (!form.full_name.trim())        return 'Full name is required.'
  if (!form.username.trim() || form.username.trim().length < 3)
                                     return 'Username must be at least 3 characters.'
  if (!/^[a-zA-Z0-9._-]+$/.test(form.username))
                                     return 'Username may only contain letters, numbers, dots, hyphens, underscores.'
  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                     return 'Valid email is required.'
  if (form.password.length < 8)      return 'Password must be at least 8 characters.'
  if (form.password !== form.confirmPassword)
                                     return 'Passwords do not match.'
  if (form.phone && !/^[+\d\s\-()]{7,15}$/.test(form.phone))
                                     return 'Phone number format is invalid.'
  if (!workMode)                     return 'Please select your work mode (WFO or WFH).'
  if (workMode === 'WFO' && !enrollId.trim())
                                     return 'Biometric Enroll ID is required for WFO employees.'
  return ''
}

export default function EmployeeSignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<SignupForm>(EMPTY)
  const [workMode, setWorkMode] = useState<WorkMode>('')
  const [enrollId, setEnrollId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function field(key: keyof SignupForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate(form, workMode, enrollId)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    try {
      const payload: Parameters<typeof authApi.employeeSignup>[0] = {
        full_name:  form.full_name.trim(),
        username:   form.username.trim().toLowerCase(),
        email:      form.email.trim().toLowerCase(),
        password:   form.password,
        phone:      form.phone.trim(),
        department: form.department.trim(),
        work_mode:  workMode as 'WFO' | 'WFH',
      }
      if (workMode === 'WFO' && enrollId.trim()) {
        payload.enroll_id = enrollId.trim()
      }

      const res = await authApi.employeeSignup(payload)

      if (!res.data.success) {
        setError(res.data.message ?? 'Signup failed. Please try again.')
        return
      }

      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => navigate('/login', { replace: true }), 1800)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Signup failed. Please try again.')
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthLayout>
      <div className="text-center mb-10">
        <h1 className="text-2xl font-extrabold text-primary-900 mb-2">Create Account</h1>
        <p className="text-sm text-gray-500">Register as an employee</p>
      </div>

      {error   && <ErrorAlert type="error"   message={error} />}
      {success && <ErrorAlert type="success" message={success} />}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Full Name"
          icon={<i className="fas fa-user text-base" />}
          type="text"
          value={form.full_name}
          onChange={field('full_name')}
          placeholder="Jane Smith"
          required
        />
        <Input
          label="Username"
          icon={<i className="fas fa-at text-base" />}
          type="text"
          value={form.username}
          onChange={field('username')}
          placeholder="jane.smith"
          required
        />
        <Input
          label="Email"
          icon={<i className="fas fa-envelope text-base" />}
          type="email"
          value={form.email}
          onChange={field('email')}
          placeholder="jane@example.com"
          required
        />
        <Input
          label="Phone"
          icon={<i className="fas fa-phone text-base" />}
          type="tel"
          value={form.phone}
          onChange={field('phone')}
          placeholder="+91 98765 43210"
        />
        <Input
          label="Department"
          icon={<i className="fas fa-building text-base" />}
          type="text"
          value={form.department}
          onChange={field('department')}
          placeholder="Engineering"
        />

        {/* Work Mode Selection */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Work Mode <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWorkMode('WFO')}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${
                workMode === 'WFO'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                workMode === 'WFO' ? 'bg-blue-600' : 'bg-gray-100'
              }`}>
                <i className={`fas fa-building text-[16px] ${workMode === 'WFO' ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-[13px] font-bold leading-tight ${workMode === 'WFO' ? 'text-blue-700' : 'text-gray-700'}`}>
                  Work From Office
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Biometric check-in</p>
              </div>
              {workMode === 'WFO' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                  Selected
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setWorkMode('WFH'); setEnrollId('') }}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-4 text-center transition-all ${
                workMode === 'WFH'
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                workMode === 'WFH' ? 'bg-emerald-600' : 'bg-gray-100'
              }`}>
                <i className={`fas fa-house text-[16px] ${workMode === 'WFH' ? 'text-white' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className={`text-[13px] font-bold leading-tight ${workMode === 'WFH' ? 'text-emerald-700' : 'text-gray-700'}`}>
                  Work From Home
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Geo / selfie check-in</p>
              </div>
              {workMode === 'WFH' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                  Selected
                </span>
              )}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Choose how you'll work. This is set once here and used for your attendance — contact HR to change it later.
          </p>
        </div>

        {/* Enroll ID — only for WFO */}
        {workMode === 'WFO' && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Biometric Enroll ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <i className="fas fa-fingerprint text-base" />
              </span>
              <input
                type="text"
                value={enrollId}
                onChange={e => setEnrollId(e.target.value)}
                placeholder="e.g. 47"
                className="w-full h-11 pl-10 pr-4 text-[14px] border border-gray-300 rounded-xl bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Your numeric ID on the office biometric machine. Ask HR if you don't know it.
            </p>
          </div>
        )}

        <Input
          label="Password"
          icon={<i className="fas fa-lock text-base" />}
          type="password"
          value={form.password}
          onChange={field('password')}
          placeholder="Min. 8 characters"
          required
        />
        <Input
          label="Confirm Password"
          icon={<i className="fas fa-lock text-base" />}
          type="password"
          value={form.confirmPassword}
          onChange={field('confirmPassword')}
          placeholder="Repeat password"
          required
        />

        <Button type="submit" loading={isLoading} disabled={!!success}>
          <i className="fas fa-user-plus" /> Sign Up
        </Button>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-700 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
