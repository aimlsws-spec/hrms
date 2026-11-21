import { ReactNode, useState } from 'react'

const FEATURES = [
  { icon: 'fas fa-users',       label: 'Employee Management' },
  { icon: 'fas fa-calendar-check', label: 'Leave Management' },
  { icon: 'fas fa-file-alt',    label: 'Document Generation' },
  { icon: 'fas fa-robot',       label: 'AI Assistant' },
  { icon: 'fas fa-chart-line',  label: 'Real-time Analytics' },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  const [logoError, setLogoError] = useState(false)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-300 to-primary-900 p-4">
      <div
        className="
          w-full max-w-[900px] min-h-[680px]
          grid grid-cols-1 md:grid-cols-[45%_55%]
          rounded-[32px] overflow-hidden
          shadow-[0_30px_80px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.2)]
          animate-[slideUp_0.8s_cubic-bezier(0.16,1,0.3,1)]
        "
        style={{ animation: 'slideUp 0.8s cubic-bezier(0.16,1,0.3,1)' }}
      >
        {/* ── Left panel: branding ── */}
        <div className="hidden md:flex flex-col justify-center items-center px-8 py-10 text-white bg-primary-900/95 relative overflow-hidden">
          <div className="absolute w-72 h-72 rounded-full bg-white/10 -top-24 -right-24 pointer-events-none" />
          {!logoError && (
            <img
              src="/trademark-logo-new.png"
              alt="Seawind Solutions Logo"
              className="w-[125px] h-auto mb-8 rounded-xl object-contain drop-shadow-2xl"
              onError={() => setLogoError(true)}
            />
          )}
          <h2 className="text-2xl font-extrabold mb-4 text-center drop-shadow">
            Seawind Solution HRMS
          </h2>
          <p className="text-sm text-center leading-relaxed mb-10 opacity-90">
            Advanced Human Resource Management System
          </p>
          <ul className="w-full space-y-3">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-3 px-4 py-2.5 bg-white/10 rounded-xl text-sm backdrop-blur-sm transition-all hover:bg-white/20 hover:translate-x-1"
              >
                <i className={`${f.icon} text-base`} />
                {f.label}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Right panel: form slot ── */}
        <div className="flex flex-col justify-center px-8 md:px-10 py-10 bg-white/95">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>
    </div>
  )
}
