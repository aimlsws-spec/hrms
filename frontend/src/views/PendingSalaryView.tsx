/**
 * Pending Tasks (HR dashboard) — MVC view layer.
 *
 * Shows one task per new employee who still needs a salary (and job title). A task disappears the
 * moment HR saves it, and the whole panel disappears when nothing is pending. All data/actions
 * come from the usePendingSalaries controller; only local form state lives here.
 */
import { useState } from 'react'
import Avatar from '../components/ui/Avatar'
import { usePendingSalaries } from '../controllers/usePendingSalaries'

function joinedText(iso?: string | null): string {
  if (!iso) return 'recently'
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

const MODE_LABEL: Record<string, string> = { WFO: 'Work from Office', WFH: 'Work from Home' }

export default function PendingSalaryView() {
  const { pending, isLoading, saveSalary } = usePendingSalaries()

  const [activeId, setActiveId]       = useState<string | null>(null)
  const [ctc, setCtc]                 = useState('')
  const [designation, setDesignation] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  function openForm(employeeId: string) {
    setActiveId(employeeId)
    setCtc('')
    setDesignation('')
    setError(null)
  }

  async function handleSave(employeeId: string) {
    const value = parseFloat(ctc)
    if (!value || value <= 0) {
      setError('Enter a valid annual CTC')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await saveSalary(employeeId, value, designation)
      if (!res.success) {
        setError(res.message ?? 'Failed to save salary')
        return
      }
      setActiveId(null)
    } catch {
      setError('Failed to save salary')
    } finally {
      setSaving(false)
    }
  }

  // Nothing to do: the panel is not shown at all.
  if (isLoading || pending.length === 0) return null

  return (
    <section
      aria-label="Pending tasks"
      className="rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-amber-200/70">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <i className="fas fa-list-check text-amber-600 text-[14px]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Pending tasks</h2>
            <p className="text-[11px] text-amber-700">New employees need their details before payroll can run.</p>
          </div>
        </div>
        <span className="text-xs bg-amber-500 text-white px-2.5 py-1 rounded-full font-semibold shrink-0">
          {pending.length} to do
        </span>
      </div>

      <ul className="divide-y divide-amber-200/60">
        {pending.map(emp => (
          <li key={emp.employee_id} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar name={emp.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800">
                  <span className="font-semibold">{emp.name}</span> signed up {joinedText(emp.joined_on)}.
                  {' '}You have to fill in their <span className="font-semibold">salary</span> and employee details.
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                  {emp.employee_id} · {emp.department}
                  {emp.work_mode ? ` · ${MODE_LABEL[emp.work_mode] ?? emp.work_mode}` : ''}
                </p>
              </div>
              {activeId !== emp.employee_id && (
                <button
                  onClick={() => openForm(emp.employee_id)}
                  className="shrink-0 text-xs bg-primary-600 text-white hover:bg-primary-700 px-3 py-1.5 rounded-lg font-semibold transition-colors"
                >
                  Add details
                </button>
              )}
            </div>

            {activeId === emp.employee_id && (
              <div className="mt-3 pl-0 sm:pl-11 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Annual CTC (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px]">₹</span>
                      <input
                        type="number"
                        autoFocus
                        value={ctc}
                        onChange={e => { setCtc(e.target.value); setError(null) }}
                        onKeyDown={e => e.key === 'Enter' && handleSave(emp.employee_id)}
                        placeholder="e.g. 600000"
                        className="w-full h-9 pl-7 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Designation (optional)</label>
                    <input
                      type="text"
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSave(emp.employee_id)}
                      placeholder="e.g. Software Developer"
                      maxLength={100}
                      className="w-full h-9 px-3 text-[13px] border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-50 transition"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSave(emp.employee_id)}
                    disabled={saving || !ctc.trim()}
                    className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition"
                  >
                    {saving ? <i className="fas fa-circle-notch animate-spin" /> : 'Save and mark done'}
                  </button>
                  <button
                    onClick={() => setActiveId(null)}
                    disabled={saving}
                    className="h-9 px-3 text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-[11px] text-gray-500">
                  The salary breakdown (basic, HRA, PF and so on) is worked out automatically from the CTC.
                </p>
                {error && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <i className="fas fa-circle-exclamation" /> {error}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
