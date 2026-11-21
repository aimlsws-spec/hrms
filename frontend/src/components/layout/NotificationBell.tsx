import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'

interface Notification {
  id:         number
  title:      string
  message:    string
  type:       string
  is_read:    number | boolean
  created_at: string
}

const POLL_MS = 30_000

export default function NotificationBell() {
  const user     = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [items, setItems]   = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen]     = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!user?.user_id) return
    try {
      const { data } = await client.get(`/notifications/${user.user_id}`)
      setItems(data?.notifications ?? [])
      setUnread(data?.unread_count ?? 0)
    } catch {
      /* bell is best-effort */
    }
  }, [user?.user_id])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const markAllRead = async () => {
    if (!user?.user_id) return
    try {
      await client.post(`/notifications/mark-all-read/${user.user_id}`)
      setItems((l) => l.map((n) => ({ ...n, is_read: 1 })))
      setUnread(0)
    } catch { /* ignore */ }
  }

  const openItem = async (n: Notification) => {
    if (!n.is_read) {
      try { await client.post(`/notifications/mark-read/${n.id}`) } catch { /* ignore */ }
      setItems((l) => l.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)))
      setUnread((c) => Math.max(0, c - 1))
    }
    setOpen(false)
    // A new-employee notice sends HR to the dashboard, where the Pending Salary panel lives.
    if (n.type === 'new_employee_salary') navigate('/hr/dashboard')
    else if (n.type === 'leave_request') navigate('/hr/dashboard')
    else if (n.type === 'regularization_request') navigate('/attendance')
    else if (n.type === 'regularization_decision') navigate('/employee/attendance')
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load() }}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-primary-800 hover:bg-gray-50 transition-colors"
        aria-label="Notifications"
      >
        <i className="fas fa-bell text-sm" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <p className="text-[13px] font-semibold text-gray-800">Notifications</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary-800 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-gray-400">No notifications</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${n.is_read ? '' : 'bg-primary-50/40'}`}
                >
                  <p className="text-[12px] font-semibold text-gray-800">{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
