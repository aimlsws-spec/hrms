import { useState, FormEvent } from 'react'
import Card from '../ui/Card'
import SectionHeader from '../ui/SectionHeader'
import { announcementsApi } from '../../api/announcements'
import { useAuthStore } from '../../store/authStore'

interface Props {
  onCreated?: () => void
}

export default function CreateAnnouncementForm({ onCreated }: Props) {
  const { user } = useAuthStore()
  const [title, setTitle]     = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setIsLoading(true)
    setError('')
    try {
      const { data } = await announcementsApi.create({
        title: title.trim(),
        message: message.trim(),
        created_by: user.user_id,
        creator_name: user.full_name,
        creator_role: user.role,
      })
      if (data.success) {
        setTitle('')
        setMessage('')
        onCreated?.()
      } else {
        setError(data.message ?? 'Failed to post announcement')
      }
    } catch {
      setError('Connection error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card padding="sm">
      <SectionHeader title="Post Announcement" />
      {error && (
        <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <input
          type="text"
          placeholder="Announcement title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-gray-50 placeholder-gray-400 transition-all"
        />
        <textarea
          placeholder="Write your message…"
          rows={3}
          value={message}
          onChange={e => setMessage(e.target.value)}
          required
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-gray-50 placeholder-gray-400 transition-all"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Posting…' : 'Post Announcement'}
        </button>
      </form>
    </Card>
  )
}
