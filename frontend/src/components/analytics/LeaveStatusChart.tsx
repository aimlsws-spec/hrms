import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import Card from '../ui/Card'
import type { ChartPoint } from '../../types/analytics'

const STATUS_COLORS: Record<string, string> = {
  Pending:  '#f59e0b',
  Approved: '#16a34a',
  Rejected: '#dc2626',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700">{name}</p>
      <p className="text-gray-500 mt-0.5">{value} request{value !== 1 ? 's' : ''}</p>
    </div>
  )
}

interface Props {
  data: ChartPoint[]
  isLoading: boolean
}

export default function LeaveStatusChart({ data, isLoading }: Props) {
  const hasData = data.some(d => d.value > 0)
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Leave Requests by Status</h3>
      {isLoading ? (
        <div className="h-52 bg-gray-100 rounded-xl animate-pulse" />
      ) : !hasData ? (
        <p className="text-sm text-gray-400 text-center py-12">No leave request data.</p>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {data.map((d, i) => (
                    <Cell key={i} fill={STATUS_COLORS[d.name] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-gray-800">{total}</span>
              <span className="text-[11px] text-gray-400 font-medium">Requests</span>
            </div>
          </div>

          {/* Legend row */}
          <div className="flex items-center justify-center gap-5 mt-3 flex-wrap">
            {data.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[d.name] ?? '#94a3b8' }} />
                <span className="text-xs text-gray-600 font-medium">{d.name}</span>
                <span className="text-xs text-gray-400">({d.value})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
