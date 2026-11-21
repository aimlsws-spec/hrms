import { useState, useEffect, useCallback, useMemo } from 'react'
import { accountantApi, type PayrollRow } from '../../api/accountantApi'

function fmt(n: number | null | undefined): string {
  if (n == null) return '₹0'
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function fmtDec(n: number | null | undefined): string {
  if (n == null) return '₹0.00'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initials(name: string): string {
  if (!name) return '?'
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const now = new Date()
const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

export default function HRPayrollPage() {
  const [rows,          setRows]          = useState<PayrollRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [monthYear,     setMonthYear]     = useState(defaultMonth)
  const [searchTerm,    setSearchTerm]    = useState('')
  const [selectedDept,  setSelectedDept]  = useState('ALL')
  const [statusFilter,  setStatusFilter]  = useState<'ALL' | 'Paid' | 'Pending'>('ALL')
  const [breakdownRow,  setBreakdownRow]  = useState<PayrollRow | null>(null)

  const load = useCallback(async (month: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await accountantApi.getPayroll(month)
      setRows(res.data)
    } catch {
      setError('Failed to load payroll records for ' + month)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(monthYear)
  }, [load, monthYear])

  // Navigate months
  const shiftMonth = (delta: number) => {
    const [y, m] = monthYear.split('-').map(Number)
    const dt = new Date(y, m - 1 + delta, 1)
    const next = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    setMonthYear(next)
  }

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { if (r.dept) set.add(r.dept) })
    return Array.from(set).sort()
  }, [rows])

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = !searchTerm ||
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDept = selectedDept === 'ALL' || r.dept === selectedDept
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter
      return matchesSearch && matchesDept && matchesStatus
    })
  }, [rows, searchTerm, selectedDept, statusFilter])

  // Summary KPI statistics
  const stats = useMemo(() => {
    const totalGross = rows.reduce((s, r) => s + (r.monthly_salary || r.salary || 0), 0)
    const totalNet   = rows.reduce((s, r) => s + (r.net_payable || r.salary || 0), 0)
    const totalLeaveDed = rows.reduce((s, r) => s + (r.leave_deduction || 0), 0)
    const totalPT    = rows.reduce((s, r) => s + (r.pt_deduction || 0), 0)
    const paidCount  = rows.filter(r => r.status === 'Paid').length
    const pendingCount = rows.filter(r => r.status === 'Pending').length
    return { totalGross, totalNet, totalLeaveDed, totalPT, paidCount, pendingCount }
  }, [rows])

  // CSV Export
  const exportCSV = () => {
    if (rows.length === 0) return
    const headers = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Monthly Gross Salary (INR)',
      'Paid Leave Days Used',
      'Unpaid / LOP Days',
      'Professional Tax (INR)',
      'Leave Deductions (INR)',
      'Net Payable (INR)',
      'Payment Status',
      'Payroll Month',
    ]
    const csvRows = rows.map(r => [
      `"${r.id}"`,
      `"${r.name}"`,
      `"${r.dept || ''}"`,
      r.monthly_salary || r.salary || 0,
      r.paid_leave_used || 0,
      r.unpaid_days || 0,
      r.pt_deduction || 0,
      r.leave_deduction || 0,
      r.net_payable || r.salary || 0,
      `"${r.status}"`,
      `"${r.month || monthYear}"`,
    ])
    const content = [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n')
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `HRMS_Payroll_${monthYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Days in month calculation for breakdown
  const daysInSelectedMonth = useMemo(() => {
    const [y, m] = monthYear.split('-').map(Number)
    return new Date(y, m, 0).getDate()
  }, [monthYear])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <i className="fa-solid fa-money-bill-wave text-[17px]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Payroll Verification & Checking</h1>
              <p className="text-[12px] text-gray-500">
                View canonical employee salaries, leave deductions, and payment statuses computed by the payroll engine.
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector & Export Button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => shiftMonth(-1)}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title="Previous Month"
            >
              <i className="fa-solid fa-chevron-left text-[11px]" />
            </button>
            <input
              type="month"
              value={monthYear}
              onChange={e => setMonthYear(e.target.value)}
              className="h-7 px-2 text-[12px] font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
            <button
              onClick={() => shiftMonth(1)}
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title="Next Month"
            >
              <i className="fa-solid fa-chevron-right text-[11px]" />
            </button>
          </div>

          <button
            onClick={() => load(monthYear)}
            disabled={loading}
            className="h-9 px-3 text-[12px] font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
            title="Reload payroll records"
          >
            <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={exportCSV}
            disabled={loading || rows.length === 0}
            className="h-9 px-3.5 text-[12px] font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
          >
            <i className="fa-solid fa-file-csv text-[13px]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Gross Payroll</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{fmt(stats.totalGross)}</p>
          <p className="text-[10px] text-gray-400">{rows.length} total employees</p>
        </div>

        <div className="bg-white rounded-2xl border border-indigo-100 bg-indigo-50/20 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wide">Net Payable</p>
          <p className="text-xl font-bold text-indigo-700 tabular-nums">{fmt(stats.totalNet)}</p>
          <p className="text-[10px] text-indigo-500">Post deductions</p>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Paid Salaries</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums">{stats.paidCount}</p>
          <p className="text-[10px] text-emerald-500">Completed by accounts</p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 bg-amber-50/20 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">Pending Salaries</p>
          <p className="text-xl font-bold text-amber-700 tabular-nums">{stats.pendingCount}</p>
          <p className="text-[10px] text-amber-500">Awaiting payout</p>
        </div>

        <div className="bg-white rounded-2xl border border-rose-100 bg-rose-50/20 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide">Leave Deductions</p>
          <p className="text-xl font-bold text-rose-700 tabular-nums">{fmt(stats.totalLeaveDed)}</p>
          <p className="text-[10px] text-rose-500">Unpaid leave & LOP</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Professional Tax</p>
          <p className="text-xl font-bold text-gray-800 tabular-nums">{fmt(stats.totalPT)}</p>
          <p className="text-[10px] text-gray-400">Statutory ₹200/emp</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-500 text-[14px]" />
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
          </div>
          <button onClick={() => load(monthYear)} className="text-[12px] font-semibold text-red-600 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[12px]" />
          <input
            type="text"
            placeholder="Search employee by name or ID…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 pl-9 pr-3 text-[12px] border border-gray-200 rounded-xl bg-gray-50/50 w-full focus:outline-none focus:border-indigo-400 focus:bg-white transition"
          />
        </div>

        <select
          value={selectedDept}
          onChange={e => setSelectedDept(e.target.value)}
          className="h-9 px-3 text-[12px] border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-indigo-400"
        >
          <option value="ALL">All Departments</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-[11px] font-semibold">
          {(['ALL', 'Paid', 'Pending'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === s ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === 'ALL' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Payroll Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                {['Employee', 'Department', 'Monthly Gross', 'Paid Leaves', 'Unpaid Days', 'Prof. Tax', 'Leave Deduction', 'Net Payable', 'Status', 'Calculation'].map(h => (
                  <th key={h} className="text-left px-3.5 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3.5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        <div className="space-y-1">
                          <div className="h-3 w-28 bg-gray-200 rounded" />
                          <div className="h-2 w-16 bg-gray-100 rounded" />
                        </div>
                      </div>
                    </td>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-3.5 py-3.5">
                        <div className="h-3 w-16 bg-gray-100 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <i className="fa-solid fa-money-bill-wave text-[22px]" />
                      </div>
                      <p className="text-[13px] font-semibold text-gray-700">No payroll records match your filter</p>
                      <p className="text-[11px] text-gray-400">Try adjusting your search or selected month</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee */}
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {initials(row.name)}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-800 text-[13px]">{row.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{row.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="px-3.5 py-3 text-gray-600 font-medium whitespace-nowrap">
                      {row.dept || '—'}
                    </td>

                    {/* Monthly Gross */}
                    <td className="px-3.5 py-3 font-semibold text-gray-800 whitespace-nowrap">
                      {fmt(row.monthly_salary || row.salary)}
                    </td>

                    {/* Paid Leave Used */}
                    <td className="px-3.5 py-3 text-emerald-700 whitespace-nowrap font-medium">
                      {(row.paid_leave_used ?? 0) > 0 ? (
                        <span>
                          {Number(row.paid_leave_used).toFixed(1)} day{row.paid_leave_used !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Unpaid Days */}
                    <td className="px-3.5 py-3 text-amber-600 font-semibold whitespace-nowrap">
                      {(row.unpaid_days ?? 0) > 0 ? (
                        <span>
                          {Number(row.unpaid_days).toFixed(1)} day{row.unpaid_days !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Professional Tax */}
                    <td className="px-3.5 py-3 text-gray-600 font-medium whitespace-nowrap">
                      {fmt(row.pt_deduction || 0)}
                    </td>

                    {/* Leave Deduction */}
                    <td className="px-3.5 py-3 font-semibold whitespace-nowrap">
                      {(row.leave_deduction ?? 0) > 0 ? (
                        <span className="text-rose-600">-{fmt(row.leave_deduction)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Net Payable */}
                    <td className="px-3.5 py-3 font-bold text-gray-900 whitespace-nowrap text-[13px]">
                      {fmt(row.net_payable || row.salary)}
                    </td>

                    {/* Payment Status */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                        row.status === 'Paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                        {row.status}
                      </span>
                    </td>

                    {/* View Calculation Breakdown */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <button
                        onClick={() => setBreakdownRow(row)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100/70 px-2.5 py-1 rounded-lg transition"
                      >
                        <i className="fa-solid fa-calculator text-[10px]" />
                        Breakdown
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown Modal */}
      {breakdownRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Salary Calculation Breakdown</h3>
                <p className="text-[12px] text-gray-500">
                  {breakdownRow.name} ({breakdownRow.id}) • {breakdownRow.dept || 'General'}
                </p>
              </div>
              <button
                onClick={() => setBreakdownRow(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition"
              >
                <i className="fa-solid fa-xmark text-[14px]" />
              </button>
            </div>

            {/* Computation Steps */}
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="font-semibold text-gray-800">Monthly Gross Salary</p>
                  <p className="text-[11px] text-gray-400">Fixed monthly pay</p>
                </div>
                <p className="font-bold text-gray-900">{fmtDec(breakdownRow.monthly_salary || breakdownRow.salary)}</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="font-semibold text-gray-800">Per-Day Rate</p>
                  <p className="text-[11px] text-gray-400">Monthly Gross ÷ {daysInSelectedMonth} days in month</p>
                </div>
                <p className="font-mono font-medium text-gray-700">
                  {fmtDec((breakdownRow.monthly_salary || breakdownRow.salary) / daysInSelectedMonth)} / day
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div>
                  <p className="font-semibold text-emerald-800">Paid Leave Consumed</p>
                  <p className="text-[11px] text-emerald-600">Covered by approved leave balances (no salary deduction)</p>
                </div>
                <p className="font-bold text-emerald-700">
                  {Number(breakdownRow.paid_leave_used || 0).toFixed(1)} day(s)
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                <div>
                  <p className="font-semibold text-rose-800">Unpaid Leaves / LOP</p>
                  <p className="text-[11px] text-rose-600">
                    {Number(breakdownRow.unpaid_days || 0).toFixed(1)} day(s) × Per-day rate
                  </p>
                </div>
                <p className="font-bold text-rose-700">
                  - {fmtDec(breakdownRow.leave_deduction || 0)}
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="font-semibold text-gray-800">Professional Tax (PT)</p>
                  <p className="text-[11px] text-gray-400">Statutory employee tax deduction</p>
                </div>
                <p className="font-bold text-gray-700">
                  - {fmtDec(breakdownRow.pt_deduction || 0)}
                </p>
              </div>

              {/* Total Calculation */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-950 font-bold">
                <div>
                  <p className="text-sm">Final Net Payable</p>
                  <p className="text-[11px] font-normal text-indigo-600">Gross − Leave Deductions − PT</p>
                </div>
                <p className="text-xl text-indigo-700 font-mono">
                  {fmtDec(breakdownRow.net_payable || breakdownRow.salary)}
                </p>
              </div>
            </div>

            {/* Payment status badge in modal */}
            <div className="flex items-center justify-between pt-2">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full border ${
                breakdownRow.status === 'Paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-100'
              }`}>
                <span className={`w-2 h-2 rounded-full ${breakdownRow.status === 'Paid' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                Status: {breakdownRow.status}
              </span>

              <button
                onClick={() => setBreakdownRow(null)}
                className="h-9 px-4 bg-gray-900 hover:bg-black text-white text-[12px] font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
