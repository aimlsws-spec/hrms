import React, { useState, useEffect, useCallback } from 'react'
import { hrFeaturesApi, type HRActivityLog } from '../../api/hrFeaturesApi'

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'APPLIED_LEAVE_ON_BEHALF', label: 'Leave Applied on Behalf' },
  { value: 'LEAVE_APPROVED', label: 'Leave Approved' },
  { value: 'LEAVE_REJECTED', label: 'Leave Rejected' },
  { value: 'LATE_DEDUCTION_APPLIED', label: 'Late Deduction Applied' },
  { value: 'LATE_DEDUCTION_IGNORED', label: 'Late Deduction Waived/Ignored' },
]

function getActionBadge(action: string) {
  const act = action.toUpperCase()
  if (act.includes('APPLIED_LEAVE') || act.includes('ON_BEHALF')) {
    return {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: 'fa-solid fa-user-pen',
      label: 'Leave On Behalf',
    }
  }
  if (act.includes('APPROVED')) {
    return {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: 'fa-solid fa-check',
      label: 'Leave Approved',
    }
  }
  if (act.includes('REJECTED')) {
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: 'fa-solid fa-xmark',
      label: 'Leave Rejected',
    }
  }
  if (act.includes('DEDUCTION_APPLIED')) {
    return {
      bg: 'bg-amber-50 text-amber-800 border-amber-200',
      icon: 'fa-solid fa-circle-minus',
      label: 'Deduction Applied',
    }
  }
  if (act.includes('DEDUCTION_IGNORED')) {
    return {
      bg: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: 'fa-solid fa-hand-holding-heart',
      label: 'Deduction Waived',
    }
  }
  return {
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: 'fa-solid fa-bolt',
    label: action,
  }
}

export default function HRActivityLogsPage() {
  const [logs, setLogs] = useState<HRActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [search, setSearch] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchLogs = useCallback(async (p: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const res = await hrFeaturesApi.getActivityLogs({
        page: p,
        limit: 25,
        action: selectedAction || undefined,
        role: selectedRole || undefined,
        search: search.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      if (res.data?.success) {
        setLogs(res.data.logs || [])
        setTotalPages(res.data.total_pages || 1)
        setTotalCount(res.data.total || 0)
        setPage(res.data.page || 1)
      } else {
        setError(res.data?.message || 'Could not fetch logs.')
      }
    } catch {
      setError('Failed to communicate with log server.')
    } finally {
      setLoading(false)
    }
  }, [selectedAction, selectedRole, search, startDate, endDate])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm shadow-indigo-200">
            <i className="fa-solid fa-list-check text-base" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">HR Activity Log</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                {totalCount} Total Actions
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive audit trail of leaves applied on behalf, decisions, deduction reviews, and HR modifications.
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="h-9 px-3.5 text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
        >
          <i className={`fa-solid fa-rotate-right text-[11px] ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="relative md:col-span-2">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search by HR actor, employee name/ID, details..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-indigo-400 focus:bg-white transition"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={e => setSelectedAction(e.target.value)}
              className="w-full h-9 px-3 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-indigo-400 focus:bg-white transition text-gray-700 font-medium"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter (HR Head / Sub-HR Audit) */}
          <div>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="w-full h-9 px-3 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-indigo-400 focus:bg-white transition text-gray-700 font-medium"
            >
              <option value="">All Actors / Roles</option>
              <option value="sub_hr">Sub-HR Only</option>
              <option value="hr">HR Head Only</option>
              <option value="admin">Admin Only</option>
            </select>
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full h-9 px-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-indigo-400 text-gray-600"
              title="Start Date"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full h-9 px-2 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:border-indigo-400 text-gray-600"
              title="End Date"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchLogs(1)} className="font-semibold underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Performed By</th>
                <th className="py-3 px-4">Target Employee</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <i className="fa-solid fa-circle-notch animate-spin text-lg mb-2 text-indigo-500 block" />
                    Loading activity records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-2">
                      <i className="fa-solid fa-folder-open text-sm" />
                    </div>
                    <p className="font-semibold text-gray-700 text-xs">No HR activity records found</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const badge = getActionBadge(log.action)
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                        {log.created_at}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.bg}`}>
                          <i className={`${badge.icon} text-[9px]`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-800">{log.performed_name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            log.performed_role === 'sub_hr'
                              ? 'bg-purple-100 text-purple-700'
                              : log.performed_role === 'admin'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {log.performed_role === 'sub_hr' ? 'Sub-HR' : log.performed_role === 'admin' ? 'Admin' : 'HR Head'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-mono">{log.performed_by}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.target_employee_id ? (
                          <div>
                            <p className="font-semibold text-gray-800">
                              {log.target_employee_name || log.target_employee_id}
                            </p>
                            <span className="text-[10px] font-mono text-gray-400">{log.target_employee_id}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 leading-relaxed max-w-md">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-400 text-[11px] whitespace-nowrap">
                        {log.ip_address}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
            <span>
              Page <span className="font-bold text-gray-800">{page}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1 || loading}
                onClick={() => fetchLogs(page - 1)}
                className="px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => fetchLogs(page + 1)}
                className="px-3 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
