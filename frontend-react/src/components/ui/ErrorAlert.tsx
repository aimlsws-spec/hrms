interface ErrorAlertProps {
  type: 'error' | 'success'
  message: string
}

export default function ErrorAlert({ type, message }: ErrorAlertProps) {
  if (!message) return null

  const styles =
    type === 'error'
      ? 'bg-red-50 border-red-200 text-red-600'
      : 'bg-green-50 border-green-200 text-green-600'

  return (
    <div className={`px-4 py-3 rounded-xl mb-5 text-sm text-center border ${styles}`}>
      {message}
    </div>
  )
}
