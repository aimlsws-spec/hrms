import { useState, useCallback } from 'react'
import { useAuthStore }  from '../../store/authStore'
import { payslipApi }   from '../../api/payslipApi'
import type { PayslipData } from '../../api/payslipApi'

// Derive EMP-style employee code from user_id (mirrors other employee pages)
function toEmployeeCode(userId: number | string | undefined): string {
  if (userId == null) return ''
  const s = String(userId)
  if (/^EMP\d+$/i.test(s)) return s.toUpperCase()
  const n = parseInt(s, 10)
  return n > 0 ? `EMP${String(n).padStart(4, '0')}` : s
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function openHtml(html: string, title: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const tab  = window.open(url, '_blank', 'width=900,height=720')
  if (tab) tab.document.title = title
  // Revoke after a short delay to allow the tab to load the content
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

// ── Row used inside the payslip preview card ─────────────────────────────
function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className={`text-[13px] font-semibold ${accent ?? 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

export default function EmployeePayslipsPage() {
  const { user } = useAuthStore()
  const employeeCode = toEmployeeCode(user?.user_id)

  const [monthYear, setMonthYear] = useState(defaultMonth)
  const [slip,      setSlip]      = useState<PayslipData | null>(null)
  const [slipPdfUrl, setSlipPdfUrl] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const generate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeCode) return
    setLoading(true)
    setError(null)
    setSlip(null)
    setSlipPdfUrl(null)
    try {
      const [year, month] = monthYear.split('-').map(Number)
      const { data } = await payslipApi.generate(employeeCode, month, year)
      if (!data.success) { setError(data.message ?? 'Failed to generate payslip'); return }
      setSlip(data)
      // Check whether an official Seawind salary slip PDF exists for this period
      try {
        const { data: urlData } = await payslipApi.getSlipUrl(employeeCode, month, year)
        if (urlData.found && urlData.file_url) {
          setSlipPdfUrl(urlData.file_url)
        }
      } catch {
        // Non-fatal — PDF check failure just means we won't show the PDF button
      }
    } catch {
      setError('Could not load payslip. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [employeeCode, monthYear])

  if (!user) return null

  const inputCls = 'h-10 px-3 border-2 border-gray-200 rounded-xl text-sm bg-slate-50 text-gray-900 focus:outline-none focus:border-primary-700 focus:bg-white transition-all'

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
          <i className="fa-solid fa-file-invoice-dollar text-indigo-600 text-[13px]" />
        </div>
        <div>
          <h1 className="text-[16px] font-bold text-gray-800">My Payslips</h1>
          <p className="text-[11px] text-gray-400">View and download your monthly pay slips</p>
        </div>
      </div>

      {/* Month selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <form onSubmit={generate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">Select Month</label>
            <input
              type="month"
              className={inputCls + ' w-full'}
              value={monthYear}
              onChange={e => { setMonthYear(e.target.value); setSlip(null); setError(null) }}
              max={defaultMonth}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-[13px] font-semibold rounded-xl transition-colors shrink-0"
          >
            {loading
              ? <><i className="fa-solid fa-circle-notch animate-spin mr-1.5 text-[11px]" />Loading…</>
              : 'View Payslip'
            }
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-red-400 text-[13px]" />
          <p className="text-[13px] text-red-600">{error}</p>
        </div>
      )}

      {/* Payslip preview card */}
      {slip && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="bg-[#0f172a] px-6 py-5">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Pay Slip</p>
            <p className="text-xl font-bold text-white mt-0.5">{slip.payroll_month}</p>
            <div className="flex gap-4 mt-3 flex-wrap">
              <span className="text-[12px] text-slate-300"><span className="text-slate-500 mr-1">ID</span>{slip.employee_id}</span>
              <span className="text-[12px] text-slate-300"><span className="text-slate-500 mr-1">Dept</span>{slip.department}</span>
              <span className="text-[12px] text-slate-300"><span className="text-slate-500 mr-1">Role</span>{slip.job_title}</span>
            </div>
          </div>

          <div className="p-5 space-y-4">

            {/* Attendance section */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Attendance</p>
              <Row label="Working Days (Month)"  value={String(slip.working_days)} />
              <Row label="Days Present"          value={String(slip.present_days)} accent="text-emerald-600" />
              <Row label="Days Absent"           value={String(slip.absent_days)}  accent={slip.absent_days > 0 ? 'text-amber-500' : 'text-gray-800'} />
              <Row label="Per Day Salary"        value={fmt(slip.per_day_salary)} />
            </div>

            {/* Earnings section */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Earnings</p>
              <Row label="Monthly Salary"   value={fmt(slip.monthly_salary)} />
              <Row label={`Gross Earnings (${slip.present_days} day${slip.present_days !== 1 ? 's' : ''} × ${fmt(slip.per_day_salary)})`}
                   value={fmt(slip.gross_earnings)} />
            </div>

            {/* Leave section */}
            {((slip.paid_leave_used ?? 0) > 0 || (slip.unpaid_leave_days ?? 0) > 0) && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Leave</p>
                {(slip.paid_leave_used ?? 0) > 0 && (
                  <Row
                    label={`Paid Leave (${Number(slip.paid_leave_used).toFixed(1)} day${slip.paid_leave_used !== 1 ? 's' : ''})`}
                    value="No Deduction"
                    accent="text-emerald-600"
                  />
                )}
                {(slip.unpaid_leave_days ?? 0) > 0 && (
                  <Row
                    label={`Unpaid Leave / LWP (${Number(slip.unpaid_leave_days).toFixed(1)} day${slip.unpaid_leave_days !== 1 ? 's' : ''})`}
                    value={fmt(slip.unpaid_leave_deduction ?? 0)}
                    accent="text-red-500"
                  />
                )}
              </div>
            )}

            {/* Deductions section */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Deductions</p>
              <Row label="Professional Tax (PT)" value={fmt(slip.professional_tax)} accent="text-red-500" />
              {(slip.unpaid_leave_deduction ?? 0) > 0 && (
                <Row
                  label={`LWP Deduction (${Number(slip.unpaid_leave_days ?? 0).toFixed(1)} day${(slip.unpaid_leave_days ?? 0) !== 1 ? 's' : ''})`}
                  value={fmt(slip.unpaid_leave_deduction ?? 0)}
                  accent="text-red-500"
                />
              )}
              {slip.late_arrival_deduction != null && slip.late_arrival_deduction > 0 && (
                <Row
                  label={`Late Arrival Deduction (${slip.grace_late_count ?? 0} occ. — ${slip.late_deductions_applied ?? 0} × ½ day)`}
                  value={fmt(slip.late_arrival_deduction)}
                  accent="text-red-500"
                />
              )}
            </div>

            {/* Net salary */}
            <div className="bg-indigo-600 rounded-xl px-5 py-4 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-white">Net Salary</span>
              <span className="text-2xl font-bold text-white">{fmt(slip.net_salary)}</span>
            </div>

            {/* Official salary slip PDF (generated by Accountant module) */}
            {slipPdfUrl ? (
              <a
                href={`${slipPdfUrl}?employee_id=${encodeURIComponent(employeeCode)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
              >
                <i className="fa-solid fa-file-pdf text-[12px]" />
                View Official Salary Slip PDF
              </a>
            ) : (
              <div className="space-y-2">
                {slip.html && (
                  <button
                    onClick={() => openHtml(slip.html!, `Pay Slip — ${slip.payroll_month}`)}
                    className="w-full flex items-center justify-center gap-2 h-10 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-[13px] font-semibold transition-colors"
                  >
                    <i className="fa-solid fa-print text-[12px]" />
                    Print Preview
                  </button>
                )}
                <p className="text-center text-[11px] text-gray-400 italic">
                  Official salary slip PDF not yet generated — request via HR
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
