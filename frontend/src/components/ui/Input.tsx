import { forwardRef, InputHTMLAttributes, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: ReactNode
  rightElement?: ReactNode
  wrapperClass?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, icon, rightElement, wrapperClass, className = '', ...props }, ref) => (
    <div className={wrapperClass !== undefined ? wrapperClass : 'mb-5'}>
      {label && (
        <label className="block mb-2 text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={`w-full h-[52px] ${icon ? 'pl-12' : 'pl-4'} ${rightElement ? 'pr-12' : 'pr-4'} border-2 border-gray-200 rounded-xl text-sm bg-slate-50 text-gray-900 transition-all focus:outline-none focus:border-primary-700 focus:bg-white focus:shadow-[0_0_0_4px_rgba(30,64,175,0.1)] ${className}`}
          {...props}
        />
        {rightElement && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </span>
        )}
      </div>
    </div>
  )
)

Input.displayName = 'Input'
export default Input
