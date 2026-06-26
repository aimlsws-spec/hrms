import { useState, useEffect, useCallback } from 'react'
import {
  accountantApi,
  type MonthlyPayrollRow,
  type DeptCostRow,
  type TaxRow,
  type OvertimeRow,
  type ReimbRow,
  type ReportType,
} from '../../api/accountantApi'

// ── helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN') }

function dlReport(type: ReportType, format: 'csv' | 'pdf') {
  window.open(`/api/accountant/reports/${type}/download?format=${format}`, '_blank')
}

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-indigo-500',
  HR:          'bg-pink-400',
  Sales:       'bg-amber-400',
  Finance:     'bg-emerald-500',
  Marketing:   'bg-violet-400',
  Operations:  'bg-sky-400',
  IT:          'bg-cyan-500',
}

function deptColor(dept: string) {
  return DEPT_COLORS[dept] ?? 'bg-gray-400'
}

// ── shared sub-components ─────────────────────────────────────────────────

function SkeletonRows({ cols, rows = 4 }: { cols: number; rows?: number }) {
  return (
    <>
      {[...Array(rows)].map((_, i) => (
        <tr key={i} className="border-b border-gray-50 last:border-0">
          {[...Array(cols)].map((__, j) => (
            <td key={j} className="px-5 py-3">
              <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: j === 0 ? '60%' : '40%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function EmptyRow({ cols, msg = 'No data available' }: { cols: number; msg?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-6 text-center text-[12px] text-gray-400">{msg}</td>
    </tr>
  )
}

function DlButtons({ type }: { type: ReportType }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={() => dlReport(type, 'csv')}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
        title="Download CSV"
      >
        <i className="fa-solid fa-file-csv text-[9px]" /> CSV
      </button>
      <button
        onClick={() => dlReport(type, 'pdf')}
        className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
        title="Download PDF"
      >
        <i className="fa-solid fa-file-pdf text-[9px]" /> PDF
      </button>
    </div>
  )
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
      <p className="text-[12px] text-red-600 flex items-center gap-1.5">
        <i className="fa-solid fa-circle-exclamation text-[11px]" /> {msg}
      </p>
      <button onClick={onRetry} className="text-[11px] font-semibold text-red-500 hover:text-red-600">Retry</button>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────

export default function AccountantReportsPage() {
  const [monthly,   setMonthly]   = useState<MonthlyPayrollRow[]>([])
  const [deptCosts, setDeptCosts] = useState<DeptCostRow[]>([])
  const [taxRows,   setTaxRows]   = useState<TaxRow[]>([])
  const [otRows,    setOtRows]    = useState<OvertimeRow[]>([])
  const [reimbRows, setReimbRows] = useState<ReimbRow[]>([])

  const [loadingTop,   setLoadingTop]   = useState(true)
  const [loadingTax,   setLoadingTax]   = useState(true)
  const [loadingOt,    setLoadingOt]    = useState(true)
  const [loadingReim,  setLoadingReim]  = useState(true)

  const [errTop,  setErrTop]  = useState<string | null>(null)
  const [errTax,  setErrTax]  = useState<string | null>(null)
  const [errOt,   setErrOt]   = useState<string | null>(null)
  const [errReim, setErrReim] = useState<string | null>(null)

  const loadTop = useCallback(async () => {
    setLoadingTop(true); setErrTop(null)
    try {
      const [mRes, dRes] = await Promise.all([
        accountantApi.getMonthlyPayroll(),
        accountantApi.getDepartmentCost(),
      ])
      setMonthly(mRes.data)
      setDeptCosts(dRes.data)
    } catch { setErrTop('Failed to load payroll summary') }
    finally  { setLoadingTop(false) }
  }, [])

  const loadTax = useCallback(async () => {
    setLoadingTax(true); setErrTax(null)
    try   { const r = await accountantApi.getTaxSummary(); setTaxRows(r.data) }
    catch { setErrTax('Failed to load tax summary') }
    finally { setLoadingTax(false) }
  }, [])

  const loadOt = useCallback(async () => {
    setLoadingOt(true); setErrOt(null)
    try   { const r = await accountantApi.getOvertimeReport(); setOtRows(r.data) }
    catch { setErrOt('Failed to load overtime report') }
    finally { setLoadingOt(false) }
  }, [])

  const loadReim = useCallback(async () => {
    setLoadingReim(true); setErrReim(null)
    try   { const r = await accountantApi.getReimbursementsReport(); setReimbRows(r.data) }
    catch { setErrReim('Failed to load reimbursements report') }
    finally { setLoadingReim(false) }
  }, [])

  useEffect(() => { loadTop(); loadTax(); loadOt(); loadReim() }, [loadTop, loadTax, loadOt, loadReim])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Payroll and cost summaries</p>
      </div>

      {/* ── Row 1: Monthly Payroll + Department Cost ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Monthly Payroll Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Monthly Payroll Summary</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Last 5 months</p>
            </div>
            <DlButtons type="monthly-payroll" />
          </div>
          {errTop && <ErrorBanner msg={errTop} onRetry={loadTop} />}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Month', 'Total Cost', 'Employees', 'Avg Salary'].map(h => (
                    <th key={h} className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTop
                  ? <SkeletonRows cols={4} />
                  : monthly.length > 0
                    ? monthly.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-700">{row.month}</td>
                          <td className="px-5 py-3 font-semibold text-gray-900">{fmt(row.total)}</td>
                          <td className="px-5 py-3 text-gray-600">{row.employees}</td>
                          <td className="px-5 py-3 text-gray-600">{fmt(row.avg)}</td>
                        </tr>
                      ))
                    : <EmptyRow cols={4} />
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Cost Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-gray-800">Department Cost Summary</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Current month breakdown</p>
            </div>
            <DlButtons type="department-cost" />
          </div>
          {errTop && <ErrorBanner msg={errTop} onRetry={loadTop} />}
          <div className="p-5 space-y-3">
            {loadingTop
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-24 bg-gray-200 rounded" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full" />
                  </div>
                ))
              : deptCosts.length > 0
                ? deptCosts.map(d => (
                    <div key={d.dept}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${deptColor(d.dept)}`} />
                          <span className="text-[12px] font-medium text-gray-700">{d.dept}</span>
                          <span className="text-[10px] text-gray-400">{d.headcount} staff</span>
                        </div>
                        <span className="text-[12px] font-semibold text-gray-800">{fmt(d.total)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${deptColor(d.dept)}`} style={{ width: `${d.pct}%` }} />
                      </div>
                    </div>
                  ))
                : <p className="text-[12px] text-gray-400 text-center py-3">No data available</p>
            }
          </div>
        </div>

      </div>

      {/* ── Row 2: Tax Summary + Overtime + Reimbursements ───────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Tax Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center mb-2.5">
                  <i className="fa-solid fa-file-invoice text-slate-400 text-[12px]" />
                </div>
                <p className="text-[13px] font-semibold text-gray-800">Tax Summary</p>
                <p className="text-[11px] text-gray-400 mt-0.5">TDS deductions by employee</p>
              </div>
              <DlButtons type="tax-summary" />
            </div>
          </div>
          {errTax && <ErrorBanner msg={errTax} onRetry={loadTax} />}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Employee', 'Gross', 'Tax', 'Net'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTax
                  ? <SkeletonRows cols={4} rows={3} />
                  : taxRows.length > 0
                    ? taxRows.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-800 truncate max-w-[90px]">{r.name}</p>
                            <p className="text-[9px] text-gray-400 truncate">{r.dept}</p>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{fmt(r.gross)}</td>
                          <td className="px-4 py-2.5 text-red-500">{fmt(r.tax)}</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(r.net)}</td>
                        </tr>
                      ))
                    : <EmptyRow cols={4} />
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Overtime Report */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center mb-2.5">
                  <i className="fa-solid fa-clock text-slate-400 text-[12px]" />
                </div>
                <p className="text-[13px] font-semibold text-gray-800">Overtime Report</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Overtime hours and payout</p>
              </div>
              <DlButtons type="overtime" />
            </div>
          </div>
          {errOt && <ErrorBanner msg={errOt} onRetry={loadOt} />}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Employee', 'Dept', 'Hours', 'Payout'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingOt
                  ? <SkeletonRows cols={4} rows={3} />
                  : otRows.length > 0
                    ? otRows.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5 font-medium text-gray-800 truncate max-w-[80px]">{r.name}</td>
                          <td className="px-4 py-2.5 text-gray-400 truncate max-w-[70px]">{r.dept}</td>
                          <td className="px-4 py-2.5 text-amber-600 font-semibold">{r.hours}h</td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">{fmt(r.payout)}</td>
                        </tr>
                      ))
                    : <EmptyRow cols={4} msg="No overtime this period" />
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Reimbursements Report */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center mb-2.5">
                  <i className="fa-solid fa-receipt text-slate-400 text-[12px]" />
                </div>
                <p className="text-[13px] font-semibold text-gray-800">Reimbursements Report</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Approved claims</p>
              </div>
              <DlButtons type="reimbursements" />
            </div>
          </div>
          {errReim && <ErrorBanner msg={errReim} onRetry={loadReim} />}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Employee', 'Amount', 'Reason', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-[9px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingReim
                  ? <SkeletonRows cols={4} rows={3} />
                  : reimbRows.length > 0
                    ? reimbRows.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-800 truncate max-w-[80px]">{r.employee}</p>
                            <p className="text-[9px] text-gray-400 truncate">{r.dept}</p>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{fmt(r.amount)}</td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-[90px]">{r.reason}</td>
                          <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-[10px]">{r.approval_date}</td>
                        </tr>
                      ))
                    : <EmptyRow cols={4} msg="No approved claims" />
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
