import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean
  loadingText?: string
  children: ReactNode
}

export default function Button({ loading, loadingText, children, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button
      disabled={loading || disabled}
      className={`w-full h-[52px] bg-primary-900 text-white rounded-xl text-base font-bold cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_40px_rgba(30,58,138,0.4)] hover:bg-primary-800 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2.5 mt-3 ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {loadingText ?? 'Authenticating...'}
        </>
      ) : children}
    </button>
  )
}
