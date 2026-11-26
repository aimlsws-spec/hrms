import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { employeeExpenseApi, type MyExpense, type ExpenseStatus } from '../../api/employeeExpenseApi'

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  Pending:  'bg-amber-50 text-amber-600',
  Approved: 'bg-emerald-50 text-emerald-600',
  Rejected: 'bg-red-50 text-red-500',
}

const STATUS_DOT: Record<ExpenseStatus, string> = {
  Pending:  'bg-amber-400',
  Approved: 'bg-emerald-500',
  Rejected: 'bg-red-400',
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN')
}

const today = new Date().toISOString().slice(0, 10)

export default function EmployeeExpensesPage() {
  const { user } = useAuthStore()
  const employeeId = user?.user_id ?? ''

  const [expenses,    setExpenses]    = useState<MyExpense[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  // form state
  const [amount,        setAmount]        = useState('')
  const [reason,        setReason]        = useState('')
  const [expenseDate,   setExpenseDate]   = useState(today)
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'cash'>('UPI')
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [submitting,    setSubmitting]    = useState(false)
  const [formError,     setFormError]     = useState<string | null>(null)
  const [formSuccess,   setFormSuccess]   = useState(false)

  const load = useCallback(async () => {
    if (!employeeId) return
    setLoading(true)
    setError(null)
    try {
      const res = await employeeExpenseApi.getMyExpenses(employeeId.toString())
      setExpenses(res.data)
    } catch {
      setError('Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [employeeId])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      setFormError('Enter a valid amount greater than zero')
      return
    }
    if (!reason.trim()) {
      setFormError('Please enter a reason for the expense')
      return
    }
    if (!expenseDate) {
      setFormError('Please select an expense date')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('employee_id', employeeId.toString())
      formData.append('amount', String(amt))
      formData.append('reason', reason.trim())
      formData.append('expense_date', expenseDate)
      formData.append('payment_method', paymentMethod)
      if (receiptFile) {
        formData.append('receipt', receiptFile)
      }

      const res = await employeeExpenseApi.submitExpense(formData)
      if (res.data.success) {
        setAmount('')
        setReason('')
        setExpenseDate(today)
        setPaymentMethod('UPI')
        setReceiptFile(null)
        setFormSuccess(true)
        setTimeout(() => setFormSuccess(false), 3000)
        await load()
      } else {
        setFormError(res.data.message ?? 'Submission failed')
      }
    } catch {
      setFormError('Failed to submit expense request')
    } finally {
      setSubmitting(false)
    }
  }

  const pending  = expenses.filter(e => e.status === 'Pending').length
  const approved = expenses.filter(e => e.status === 'Approved').length
  const totalAmt = expenses
    .filter(e => e.status !== 'Rejected')
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Expenses &amp; Reimbursements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Submit and track your expense requests</p>
      </div>

      {/* Stat chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          <span className="text-[11px] font-semibold bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg">
            Pending: {pending}
          </span>
          <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg">
            Approved: {approved}
          </span>
          <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
            Total: {fmt(totalAmt)}
          </span>
        </div>
      )}

      {/* Submit form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-[14px] font-semibold text-gray-800">Submit New Expense</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Fill in the details and submit for accountant approval</p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400 font-medium">₹</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full pl-7 pr-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
                />
              </div>
            </div>

            {/* Expense date */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                max={today}
                onChange={e => setExpenseDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-2 h-[42px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMethod === 'UPI'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className="fa-solid fa-qrcode text-[11px]" />
                  UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <i className="fa-solid fa-money-bill-wave text-[11px]" />
                  Cash
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Reason / Description *
              </label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Travel tickets, client lunch, stationary supplies"
                required
                className="w-full px-3 py-2.5 text-[13px] border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-colors"
              />
            </div>

            {/* Receipt or UPI payment screenshot */}
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Receipt / UPI Screenshot
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="receipt-file-input"
                  accept=".png,.jpg,.jpeg,.pdf,.webp"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label
                  htmlFor="receipt-file-input"
                  className="flex items-center justify-between w-full px-3 py-2 text-[12px] border border-gray-200 border-dashed rounded-xl bg-gray-50 hover:bg-gray-100/80 cursor-pointer transition-colors"
                >
                  <span className="truncate text-gray-600">
                    {receiptFile ? receiptFile.name : 'Choose receipt/image…'}
                  </span>
                  <span className="shrink-0 ml-2 px-2 py-0.5 rounded-md bg-white border text-[10px] text-gray-500 font-semibold shadow-2xs">
                    {receiptFile ? 'Change' : 'Browse'}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {formError && (
            <p className="text-[12px] text-red-500 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-exclamation text-[11px]" />
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="text-[12px] text-emerald-600 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-[11px]" />
              Expense submitted successfully
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-colors"
            >
              {submitting
                ? <><i className="fa-solid fa-spinner fa-spin text-[11px]" /> Submitting…</>
                : <><i className="fa-solid fa-paper-plane text-[11px]" /> Submit Request</>
              }
            </button>
          </div>
        </form>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-red-400 text-[13px]" />
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
          <button onClick={load} className="text-[12px] font-semibold text-red-500 hover:text-red-600">
            Retry
          </button>
        </div>
      )}

      {/* History table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h3 className="text-[14px] font-semibold text-gray-800">My Expense Requests</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">All your submitted expense claims</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Expense Date', 'Reason', 'Amount', 'Payment Method', 'Receipt / Proof', 'Submitted On', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(3)].map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3.5"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-36 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-3 w-20 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="px-5 py-3.5"><div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" /></td>
                    </tr>
                  ))
                : expenses.length > 0
                  ? expenses.map(exp => (
                      <tr key={exp.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-[12px]">
                          {exp.expense_date}
                        </td>
                        <td className="px-5 py-3.5 text-gray-700 max-w-[220px]">
                          <span className="line-clamp-1">{exp.reason}</span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-gray-800">
                          {fmt(exp.amount)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            (exp.payment_method || '').toLowerCase() === 'cash'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            <i className={`fa-solid ${(exp.payment_method || '').toLowerCase() === 'cash' ? 'fa-money-bill-wave' : 'fa-qrcode'} text-[10px]`} />
                            {(exp.payment_method || 'UPI').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {exp.receipt_path ? (
                            <a
                              href={exp.receipt_path}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100 hover:text-indigo-800 transition-colors"
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                              View Proof
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No receipt</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 whitespace-nowrap text-[12px]">
                          {exp.submitted_on}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[exp.status]}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[exp.status]}`} />
                            {exp.status}
                          </span>
                          {exp.reviewed_by && exp.status !== 'Pending' && (
                            <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[120px]" title={`By ${exp.reviewed_by}`}>
                              By {exp.reviewed_by}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-[13px] text-gray-400">
                        <i className="fa-solid fa-receipt text-gray-200 text-2xl mb-2 block" />
                        No expense requests yet
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
