import { useState, useEffect, useCallback } from 'react'
import { leavesApi } from '../../api/leaves'
import type { EmployeeLeaveBalance } from '../../types/leave'

interface BalanceEditState {
  employee_id: string
  name: string
  casual_leave: number
  sick_leave: number
  earned_leave: number
  casual_total: number
  sick_total: number
  earned_total: number
}

export default function HRYearlyBalancesTab() {
  const [balances, setBalances] = useState<EmployeeLeaveBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('ALL')
  const [year, setYear] = useState<number>(new Date().getFullYear())

  // Edit modal state
  const [editTarget, setEditTarget] = useState<BalanceEditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadBalances = useCallback(async () => {
    setLoading(true)
    try {
      const res = await leavesApi.getAllBalances()
      if (res.data?.success) {
        setBalances(res.data.employees || [])
        if ((res.data as any).year) setYear((res.data as any).year)
      }
    } catch (err) {
      console.error('Failed to load leave balances', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBalances()
  }, [loadBalances])

  // Unique departments
  const departments = Array.from(new Set(balances.map(b => b.department).filter(Boolean))) as string[]

  // Filtered rows
  const filtered = balances.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !search || b.name.toLowerCase().includes(q) || b.employee_id.toLowerCase().includes(q)
    const matchDept = deptFilter === 'ALL' || b.department === deptFilter
    return matchSearch && matchDept
  })

  const handleOpenEdit = (b: EmployeeLeaveBalance) => {
    setEditTarget({
      employee_id: b.employee_id,
      name: b.name,
      casual_leave: b.casual_leave,
      sick_leave: b.sick_leave,
      earned_leave: b.earned_leave,
      casual_total: b.casual_total ?? 12,
      sick_total: b.sick_total ?? 12,
      earned_total: b.earned_total ?? 12,
    })
    setMsg(null)
  }

  const handleSaveBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)
    setMsg(null)
    try {
      const res = await leavesApi.updateBalance(editTarget.employee_id, {
        casual_leave: editTarget.casual_leave,
        sick_leave: editTarget.sick_leave,
        earned_leave: editTarget.earned_leave,
        casual_total: editTarget.casual_total,
        sick_total: editTarget.sick_total,
        earned_total: editTarget.earned_total,
      })
      if (res.data?.success) {
        setMsg({ ok: true, text: 'Balance updated successfully' })
        setTimeout(() => {
          setEditTarget(null)
          loadBalances()
        }, 800)
      } else {
        setMsg({ ok: false, text: res.data?.message || 'Update failed' })
      }
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || 'Server error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Policy Explanation Banner */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/40 to-white p-4 text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-indigo-900">
          <i className="fa-solid fa-arrows-rotate text-indigo-600" />
          <span>Yearly Leave Policy &amp; Carry-Forward Rule</span>
          <span className="ml-auto text-[10px] font-mono bg-indigo-200/50 text-indigo-800 px-2 py-0.5 rounded-full">
            Year {year}
          </span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Employees receive annual allocations of <strong>Casual Leave (12d)</strong>, <strong>Sick Leave (12d)</strong>, and <strong>Paid Leave (12d)</strong>.
          Unused balances <strong>carry forward month-to-month until the year changes</strong>. Unused balances <strong>do not carry beyond the year change</strong> and reset fresh at year-end.
        </p>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search employee by name or ID…"
              className="w-full h-9 pl-8 pr-3 text-xs border border-gray-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400"
            />
          </div>
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-gray-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-400"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
        </div>
        <button
          onClick={loadBalances}
          disabled={loading}
          className="h-9 px-3 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
        >
          <i className={`fa-solid fa-rotate-right text-xs ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Balances Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100 text-gray-500 uppercase tracking-wider text-[10px]">
                <th className="text-left px-4 py-3 font-semibold">Employee</th>
                <th className="text-left px-3 py-3 font-semibold">Role / Dept</th>
                <th className="text-center px-3 py-3 font-semibold text-amber-700 bg-amber-50/50">Casual Leave (CL)</th>
                <th className="text-center px-3 py-3 font-semibold text-red-700 bg-red-50/50">Sick Leave (SL)</th>
                <th className="text-center px-3 py-3 font-semibold text-emerald-700 bg-emerald-50/50">Paid Leave (PL)</th>
                <th className="text-center px-3 py-3 font-semibold text-indigo-700">Total Remaining</th>
                <th className="text-right px-4 py-3 font-semibold">Maintain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-gray-100 rounded w-28" /></td>
                    <td className="px-3 py-3"><div className="h-4 bg-gray-100 rounded w-20" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-3 py-3 text-center"><div className="h-4 bg-gray-100 rounded w-16 mx-auto" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 bg-gray-100 rounded w-14 ml-auto" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    No employee balances found.
                  </td>
                </tr>
              ) : (
                filtered.map(b => {
                  const cTot = b.casual_total ?? 12
                  const sTot = b.sick_total ?? 12
                  const eTot = b.earned_total ?? 12
                  const totalRem = b.casual_leave + b.sick_leave + b.earned_leave

                  return (
                    <tr key={b.employee_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900">{b.name}</span>
                          {((b as any).status === 'probation' || (cTot === 0 && sTot === 0 && eTot === 0)) && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Probation
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">{b.employee_id}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                          {b.role}
                        </span>
                        {b.department && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{b.department}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-amber-700">{b.casual_leave.toFixed(1)}</span>
                        <span className="text-[10px] text-gray-400 font-normal"> / {cTot}d</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-red-700">{b.sick_leave.toFixed(1)}</span>
                        <span className="text-[10px] text-gray-400 font-normal"> / {sTot}d</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-emerald-700">{b.earned_leave.toFixed(1)}</span>
                        <span className="text-[10px] text-gray-400 font-normal"> / {eTot}d</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {totalRem.toFixed(1)} days
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleOpenEdit(b)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <i className="fa-solid fa-sliders mr-1" />
                          Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Balance Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
                  <i className="fa-solid fa-sliders" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Adjust Yearly Leave Balance</h3>
                  <p className="text-xs text-gray-500">{editTarget.name} ({editTarget.employee_id})</p>
                </div>
              </div>
              <button
                onClick={() => setEditTarget(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 flex items-center justify-center"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <form onSubmit={handleSaveBalance} className="p-6 space-y-4">
              {msg && (
                <div className={`p-3 text-xs rounded-xl border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                  {msg.text}
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700">Casual Leave Remaining</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.casual_leave}
                      onChange={e => setEditTarget({ ...editTarget, casual_leave: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400">Casual Annual Quota</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.casual_total}
                      onChange={e => setEditTarget({ ...editTarget, casual_total: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700">Sick Leave Remaining</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.sick_leave}
                      onChange={e => setEditTarget({ ...editTarget, sick_leave: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400">Sick Annual Quota</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.sick_total}
                      onChange={e => setEditTarget({ ...editTarget, sick_total: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700">Paid Leave Remaining</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.earned_leave}
                      onChange={e => setEditTarget({ ...editTarget, earned_leave: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400">Paid Annual Quota</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editTarget.earned_total}
                      onChange={e => setEditTarget({ ...editTarget, earned_total: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
                >
                  {saving ? 'Saving…' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
