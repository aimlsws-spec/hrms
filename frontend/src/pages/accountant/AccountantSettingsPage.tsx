import { useState, useEffect, useCallback } from 'react'
import { accountantApi, type AccountantSettings } from '../../api/accountantApi'

const DEFAULT_FORM: AccountantSettings = {
  companyName:     '',
  payrollCycle:    'monthly',
  currency:        'INR',
  payDay:          '25',
  fiscalYearStart: 'april',
  notifyOnPayroll: true,
  notifyOnExpense: true,
}

export default function AccountantSettingsPage() {
  const [form,      setForm]      = useState<AccountantSettings>(DEFAULT_FORM)
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await accountantApi.getSettings()
      setForm(res.data)
    } catch {
      setLoadError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  function handleChange(field: keyof AccountantSettings, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setSaveError(null)
  }

  function validate(): string | null {
    if (!form.companyName.trim())
      return 'Company name is required'
    if (!form.currency)
      return 'Please select a currency'
    if (form.payrollCycle === 'monthly' && form.payDay !== 'last') {
      const d = Number(form.payDay)
      if (isNaN(d) || d < 1 || d > 28)
        return 'Pay day must be 1–28 or Last day of month for monthly payroll'
    }
    if (form.payrollCycle === 'biweekly' && form.payDay !== 'last') {
      const d = Number(form.payDay)
      if (isNaN(d) || d < 1 || d > 14)
        return 'Pay day must be 1–14 or Last day for bi-weekly payroll'
    }
    return null
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaved(false)
    setSaveError(null)

    const validationErr = validate()
    if (validationErr) {
      setSaveError(validationErr)
      return
    }

    setSaving(true)
    try {
      const res = await accountantApi.saveSettings(form)
      if (res.data.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setSaveError(res.data.message ?? 'Failed to save settings')
        setTimeout(() => setSaveError(null), 4000)
      }
    } catch {
      setSaveError('Failed to save settings — check connection')
      setTimeout(() => setSaveError(null), 4000)
    } finally {
      setSaving(false)
    }
  }

  const inputCls  = 'w-full text-[13px] text-gray-800 border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition'
  const selectCls = inputCls

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl animate-pulse">
        <div className="h-6 w-24 bg-gray-200 rounded" />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure payroll and panel preferences</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-[13px]" />
            <p className="text-[13px] text-red-600">{loadError}</p>
          </div>
          <button onClick={loadSettings} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure payroll and panel preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">

        {/* Company section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
            <i className="fa-solid fa-building text-gray-400 text-[11px]" />
            Company
          </h3>

          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Company Name</label>
            <input
              className={inputCls}
              value={form.companyName}
              onChange={e => handleChange('companyName', e.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Fiscal Year Start</label>
              <select
                className={selectCls}
                value={form.fiscalYearStart}
                onChange={e => handleChange('fiscalYearStart', e.target.value)}
              >
                {['January','February','March','April','May','June',
                  'July','August','September','October','November','December'].map(m => (
                  <option key={m} value={m.toLowerCase()}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Currency</label>
              <select
                className={selectCls}
                value={form.currency}
                onChange={e => handleChange('currency', e.target.value)}
              >
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="AED">AED — UAE Dirham (د.إ)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payroll section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
            <i className="fa-solid fa-money-bill-wave text-gray-400 text-[11px]" />
            Payroll
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Payroll Cycle</label>
              <select
                className={selectCls}
                value={form.payrollCycle}
                onChange={e => handleChange('payrollCycle', e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1.5">Pay Day (day of month)</label>
              <select
                className={selectCls}
                value={form.payDay}
                onChange={e => handleChange('payDay', e.target.value)}
              >
                {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
                <option value="last">Last day of month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h3 className="text-[13px] font-semibold text-gray-700 flex items-center gap-2">
            <i className="fa-solid fa-bell text-gray-400 text-[11px]" />
            Notifications
          </h3>

          {[
            { field: 'notifyOnPayroll' as const, label: 'Notify when payroll is processed' },
            { field: 'notifyOnExpense' as const, label: 'Notify on new expense requests' },
          ].map(item => (
            <label key={item.field} className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => handleChange(item.field, !form[item.field])}
                className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${
                  form[item.field] ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form[item.field] ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
              <span className="text-[13px] text-gray-700">{item.label}</span>
            </label>
          ))}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed px-5 py-2.5 rounded-xl transition-colors"
          >
            {saving
              ? <i className="fa-solid fa-spinner fa-spin text-[11px]" />
              : <i className="fa-solid fa-check text-[11px]" />
            }
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-[12px] text-emerald-600 flex items-center gap-1.5 font-medium">
              <i className="fa-solid fa-circle-check text-[11px]" />
              Settings saved
            </span>
          )}
          {saveError && (
            <span className="text-[12px] text-red-500 flex items-center gap-1.5 font-medium">
              <i className="fa-solid fa-circle-exclamation text-[11px]" />
              {saveError}
            </span>
          )}
        </div>

      </form>
    </div>
  )
}
