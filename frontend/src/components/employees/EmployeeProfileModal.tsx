import { useEffect, useState }       from 'react'
import { useProfileImageStore }      from '../../store/profileImageStore'
import { hrSalaryApi }               from '../../api/hrSalaryApi'
import type { EmployeeSalaryRecord } from '../../api/hrSalaryApi'
import type { Employee }             from '../../types/employee'
import PasswordViewer                from '../common/PasswordViewer'

interface Props {
  employee: Employee | null
  onClose:  () => void
}

function InfoRow({ icon, iconBg, iconColor, label, value }: {
  icon: string; iconBg: string; iconColor: string
  label: string; value: string | null | undefined
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
        <i className={`${icon} ${iconColor} text-[11px]`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-400 leading-none">{label}</p>
        <p className="text-[13px] font-semibold text-gray-800 mt-0.5 truncate">
          {value || <span className="text-gray-300 font-normal">--</span>}
        </p>
      </div>
    </div>
  )
}

function SalaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className={`text-[13px] font-semibold ${highlight ? 'text-red-500' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function EmployeeProfileModal({ employee, onClose }: Props) {
  const { images } = useProfileImageStore()
  const [salary, setSalary]           = useState<EmployeeSalaryRecord | null>(null)
  const [salaryLoading, setSalaryLoading] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!employee?.employee_id) return
    setSalary(null)
    setSalaryLoading(true)
    hrSalaryApi.getEmployeeSalary(employee.employee_id)
      .then(res => setSalary(res.data))
      .catch(() => setSalary(null))
      .finally(() => setSalaryLoading(false))
  }, [employee?.employee_id])

  if (!employee) return null

  // Avatar: uploaded image in store (keyed by email) → profile_url → initials
  const storeImage = employee.email ? (images[employee.email.toLowerCase()] ?? null) : null
  const avatarUrl  = storeImage ?? employee.profile_url ?? null

  // Location: city + state from employees table (set by HR; may be blank)
  const location = [employee.city, employee.state].filter(Boolean).join(', ') || null

  // Salary computed values — only ₹200 professional tax deduction per workflow
  const grossMonthly  = salary ? Math.round(salary.gross_salary) : null
  const netMonthly    = grossMonthly != null ? grossMonthly - 200 : null
  const annualCTC     = salary ? Math.round(salary.ctc) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-t-2xl bg-[#0f172a] text-white px-5 py-5">
          <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-blue-600/10" />
          <div className="pointer-events-none absolute -right-4 top-8 w-28 h-28 rounded-full bg-blue-500/10" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="shrink-0 ring-2 ring-blue-500/40 rounded-full">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={employee.name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold">
                    {initials(employee.name)}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-white leading-tight">{employee.name}</h2>
                {employee.title && <p className="text-slate-400 text-[12px] mt-0.5">{employee.title}</p>}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {employee.department && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-white/10 text-slate-300 px-1.5 py-0.5 rounded">
                      <i className="fa-solid fa-building text-[8px]" />{employee.department}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    Active
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title="Close"
            >
              <i className="fa-solid fa-xmark text-white text-sm" />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4">

          {/* Employee Info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <i className="fa-solid fa-briefcase text-indigo-500 text-[11px]" />
              </div>
              <p className="text-[13px] font-semibold text-gray-800">Employee Info</p>
            </div>
            <InfoRow icon="fa-solid fa-id-badge"  iconBg="bg-indigo-50"  iconColor="text-indigo-500"  label="Employee ID"  value={employee.employee_id} />
            <InfoRow icon="fa-solid fa-building"   iconBg="bg-blue-50"   iconColor="text-blue-500"    label="Department"   value={employee.department}  />
            <InfoRow icon="fa-solid fa-briefcase"  iconBg="bg-violet-50" iconColor="text-violet-500"  label="Designation"  value={employee.title}       />
            <InfoRow icon="fa-solid fa-envelope"   iconBg="bg-teal-50"   iconColor="text-teal-500"    label="Email"        value={employee.email}       />
            {employee.phone && (
              <InfoRow icon="fa-solid fa-phone"      iconBg="bg-blue-50"   iconColor="text-blue-500"    label="Phone"        value={employee.phone}       />
            )}
            {location && (
              <InfoRow icon="fa-solid fa-location-dot" iconBg="bg-rose-50" iconColor="text-rose-500" label="Location" value={location} />
            )}
            <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-key text-amber-500 text-[11px]" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 leading-none">Assigned Password</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">HR Controlled</p>
                </div>
              </div>
              <PasswordViewer password={employee.assigned_password} />
            </div>
          </div>

          {/* KYC & Identity Details */}
          {(employee.aadhaar_number || employee.pan_number || employee.emergency_contact_name || employee.current_address) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <i className="fa-solid fa-address-card text-cyan-600 text-[11px]" />
                </div>
                <p className="text-[13px] font-semibold text-gray-800">KYC & Identity Details</p>
              </div>
              {employee.aadhaar_number && (
                <InfoRow icon="fa-solid fa-fingerprint" iconBg="bg-cyan-50" iconColor="text-cyan-600" label="Aadhaar Number" value={`•••• •••• ${employee.aadhaar_number.slice(-4)}`} />
              )}
              {employee.pan_number && (
                <InfoRow icon="fa-solid fa-id-card" iconBg="bg-indigo-50" iconColor="text-indigo-600" label="PAN Number" value={employee.pan_number} />
              )}
              {employee.emergency_contact_name && (
                <InfoRow
                  icon="fa-solid fa-phone-volume"
                  iconBg="bg-rose-50"
                  iconColor="text-rose-500"
                  label="Emergency Contact"
                  value={`${employee.emergency_contact_name} (${employee.emergency_contact_relation || 'Relation'})${employee.emergency_number ? ` • ${employee.emergency_number}` : ''}`}
                />
              )}
              {employee.current_address && (
                <InfoRow icon="fa-solid fa-house" iconBg="bg-slate-50" iconColor="text-slate-500" label="Residential Address" value={employee.current_address} />
              )}
            </div>
          )}

          {/* Salary Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                <i className="fa-solid fa-indian-rupee-sign text-emerald-500 text-[11px]" />
              </div>
              <p className="text-[13px] font-semibold text-gray-800">Salary</p>
            </div>

            {salaryLoading ? (
              <div className="space-y-2 animate-pulse">
                {[0,1,2,3].map(i => <div key={i} className="h-3 bg-gray-100 rounded" />)}
              </div>
            ) : salary ? (
              <>
                <div className="bg-emerald-50 rounded-xl px-4 py-3 mb-3 text-center">
                  <p className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider mb-1">Monthly Net Salary</p>
                  <p className="text-2xl font-extrabold text-emerald-700 leading-none">
                    ₹{netMonthly!.toLocaleString('en-IN')}
                  </p>
                </div>
                <SalaryRow label="Annual CTC"       value={`₹${annualCTC!.toLocaleString('en-IN')}`}    />
                <SalaryRow label="Monthly Gross"    value={`₹${grossMonthly!.toLocaleString('en-IN')}`}  />
                <SalaryRow label="Professional Tax" value="₹200"                                          highlight />
                {salary.effective_from && (
                  <p className="text-[10px] text-gray-400 mt-2 text-right">Effective from {salary.effective_from}</p>
                )}
              </>
            ) : (
              <p className="text-[12px] text-gray-400 py-1">No salary record on file.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
