import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Card from '../ui/Card'
import type { TeamSizePoint } from '../../hooks/analytics/useTeamAnalytics'

interface Props {
  data: TeamSizePoint[]
  isLoading: boolean
}

export default function TeamSizeChart({ data, isLoading }: Props) {
  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Team Sizes</h3>
      {isLoading ? (
        <div className="h-52 bg-gray-100 rounded-xl animate-pulse" />
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">No teams with members yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="members" name="Members" fill="#0891b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
