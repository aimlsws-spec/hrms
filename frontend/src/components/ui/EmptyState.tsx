interface EmptyStateProps {
  message?: string
  icon?: string
}

export default function EmptyState({ message = 'No data available' }: EmptyStateProps) {
  return (
    <div className="text-center py-3 text-gray-400">
      <svg className="w-6 h-6 mx-auto mb-1.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-xs">{message}</p>
    </div>
  )
}
