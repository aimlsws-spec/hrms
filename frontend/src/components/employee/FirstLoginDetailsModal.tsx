import { useState } from 'react'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import Button from '../ui/Button'

interface Props {
  isOpen: boolean
  onCompleted: () => void
}

const RELATIONSHIPS = [
  'Father',
  'Mother',
  'Spouse',
  'Brother',
  'Sister',
  'Guardian',
  'Other',
] as const

export default function FirstLoginDetailsModal({ isOpen, onCompleted }: Props) {
  const { user, setUser } = useAuthStore()

  const [form, setForm] = useState({
    aadhaar_number: '',
    pan_number: '',
    residential_address: '',
    emergency_contact_name: '',
    emergency_contact_relation: 'Father',
    emergency_number: '',
    date_of_birth: '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  function handleChange(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validations
    const cleanAadhaar = form.aadhaar_number.replace(/\s+/g, '').replace(/-/g, '')
    if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
      setError('Aadhaar number must be exactly 12 digits.')
      return
    }

    const cleanPan = form.pan_number.trim().toUpperCase()
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
      setError('Please enter a valid 10-character PAN number (e.g. ABCDE1234F).')
      return
    }

    if (!form.residential_address.trim()) {
      setError('Residential address is required.')
      return
    }

    if (!form.emergency_contact_name.trim()) {
      setError('Emergency contact name is required.')
      return
    }

    const cleanPhone = form.emergency_number.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setError('Emergency contact phone number must be at least 10 digits.')
      return
    }

    if (!form.date_of_birth) {
      setError('Date of birth is required.')
      return
    }

    try {
      setLoading(true)
      const res = await client.post('/employee/first-login-setup', {
        employee_id: user?.user_id,
        email: user?.email,
        aadhaar_number: cleanAadhaar,
        pan_number: cleanPan,
        residential_address: form.residential_address.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_relation: form.emergency_contact_relation,
        emergency_number: cleanPhone,
        date_of_birth: form.date_of_birth,
      })

      if (res.data?.success) {
        if (user) {
          setUser({ ...user, profile_completed: true } as any)
        }
        onCompleted()
      } else {
        setError(res.data?.message || 'Failed to save first-login details.')
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error saving details. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-t-3xl">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-3 text-xl font-bold">
            <i className="fa-solid fa-id-card" />
          </div>
          <h2 className="text-xl font-bold">First-Time Sign In Setup</h2>
          <p className="text-xs text-blue-100/90 mt-1 leading-relaxed">
            Welcome to the HRMS portal! Please complete your mandatory identity and emergency contact records.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Aadhaar Number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Aadhaar Number *
            </label>
            <input
              type="text"
              required
              maxLength={14}
              placeholder="12-digit Aadhaar (e.g. 1234 5678 9012)"
              value={form.aadhaar_number}
              onChange={e => handleChange('aadhaar_number', e.target.value)}
              className="w-full h-11 px-3.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all bg-slate-50/60 font-mono"
            />
          </div>

          {/* PAN Number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              PAN Card Number *
            </label>
            <input
              type="text"
              required
              maxLength={10}
              placeholder="10-character PAN (e.g. ABCDE1234F)"
              value={form.pan_number}
              onChange={e => handleChange('pan_number', e.target.value.toUpperCase())}
              className="w-full h-11 px-3.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all bg-slate-50/60 font-mono uppercase"
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Date of Birth *
            </label>
            <input
              type="date"
              required
              value={form.date_of_birth}
              onChange={e => handleChange('date_of_birth', e.target.value)}
              className="w-full h-11 px-3.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all bg-slate-50/60"
            />
          </div>

          {/* Residential Address */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Residential Address *
            </label>
            <textarea
              required
              rows={2}
              placeholder="Enter your complete residential address"
              value={form.residential_address}
              onChange={e => handleChange('residential_address', e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 focus:bg-white transition-all bg-slate-50/60 resize-none"
            />
          </div>

          {/* Emergency Contact */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Emergency Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={form.emergency_contact_name}
                  onChange={e => handleChange('emergency_contact_name', e.target.value)}
                  className="w-full h-10 px-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-slate-50/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Relationship *</label>
                <select
                  value={form.emergency_contact_relation}
                  onChange={e => handleChange('emergency_contact_relation', e.target.value)}
                  className="w-full h-10 px-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-slate-50/60"
                >
                  {RELATIONSHIPS.map(rel => (
                    <option key={rel} value={rel}>{rel}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Emergency Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile number"
                value={form.emergency_number}
                onChange={e => handleChange('emergency_number', e.target.value)}
                className="w-full h-10 px-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-slate-50/60"
              />
            </div>
          </div>

          {/* Notice about password */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
            <i className="fa-solid fa-lock text-amber-600 mt-0.5 shrink-0" />
            <span>
              <strong>Password Notice:</strong> Your login password is assigned and managed directly by HR. Employees cannot modify the password.
            </span>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button type="submit" loading={loading} className="w-full h-12 text-sm font-bold shadow-md">
              Complete Setup & Access Portal
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
