import { useState } from 'react'

interface Props {
  password?: string | null
  className?: string
  showLabel?: boolean
}

export default function PasswordViewer({ password, className = '', showLabel = false }: Props) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!password) {
    return (
      <span className={`text-[11px] text-gray-400 italic ${className}`}>
        {showLabel && 'Password: '}No password set
      </span>
    )
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShow((prev) => !prev)
  }

  return (
    <div className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      {showLabel && <span className="text-[11px] text-gray-500 font-medium">Password:</span>}
      <span className="font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[11px] select-all">
        {show ? password : '••••••••'}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        title={show ? 'Hide password' : 'Show password'}
        className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <i className={`fa-solid ${show ? 'fa-eye-slash' : 'fa-eye'} text-[11px]`} />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy password"
        className="p-1 rounded text-gray-400 hover:text-primary-600 hover:bg-gray-100 transition-colors"
      >
        <i className={`fa-solid ${copied ? 'fa-check text-emerald-500' : 'fa-copy'} text-[11px]`} />
      </button>
      {copied && (
        <span className="text-[10px] text-emerald-600 font-medium font-sans animate-fade-in">
          Copied!
        </span>
      )}
    </div>
  )
}
