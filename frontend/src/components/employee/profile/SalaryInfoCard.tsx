import { useState, useEffect } from 'react'
import { hrSalaryApi } from '../../../api/hrSalaryApi'
import type { Mysalary } from '../../../api/hrSalaryApi'

interface Props { employeeId: string }

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      <span className={`text-[13px] font-medium ${highlight ? 'text-red-500' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}

function fmt(n: number) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export default function SalaryInfoCard({ employeeId }: Props) {
  const [salary,  setSalary]  = useState<Mysalary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) { setLoading(false); return }
    hrSalaryApi.getMySalary(employeeId)
      .then(res => setSalary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [employeeId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-5" />
        <div className="h-16 w-full bg-gray-100 rounded-xl mb-4" />
        {[0,1,2,3].map(i => <div key={i} className="h-3 w-full bg-gray-100 rounded my-3" />)}
      </div>
    )
  }

  if (!salary) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <p className="text-[14px] font-semibold text-gray-800 mb-1">Salary Breakdown</p>
        <p className="text-[12px] text-gray-400">No salary information on record.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="mb-5">
        <p className="text-[14px] font-semibold text-gray-800">Salary Breakdown</p>
        <p className="text-[12px] text-gray-400 mt-0.5">Read-only</p>
      </div>

      {/* Net salary highlight: gross - PT(200) */}
      <div className="bg-emerald-100 rounded-lg px-4 py-3 mb-4 text-center">
        <p className="text-[11px] text-emerald-800 font-semibold uppercase tracking-wider mb-1">Monthly Net Salary</p>
        <p className="text-3xl font-extrabold text-emerald-800 leading-none">{fmt(Math.max(0, salary.gross_salary - 200))}</p>
      </div>

      <Row label="Annual CTC"          value={fmt(salary.ctc)} />
      <Row label="Monthly Salary"      value={fmt(salary.gross_salary)} />
      <Row label="Professional Tax"    value="₹200" highlight />
      <Row label="Effective From"      value={salary.effective_from || '—'} />
    </div>
  )
}
