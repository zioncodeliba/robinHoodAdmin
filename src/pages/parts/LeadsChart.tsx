import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { leadsChartData } from '@/lib/mock-data'

export function LeadsChart() {
  return (
    <div className="min-w-0 flex flex-col rounded-2xl border border-[var(--color-border-light)] bg-white p-4 sm:p-6 shadow-[var(--shadow-card)] lg:col-span-2 h-full min-h-[350px] sm:min-h-[450px]">
      <div className="mb-4 shrink-0">
        <h3 className="text-base sm:text-lg font-semibold text-[var(--color-text)]">לקוחות חדשים</h3>
        <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">6 חודשים אחרונים</p>
      </div>
      <div className="w-full min-w-0 flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={leadsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              interval={0}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                direction: 'rtl',
              }}
              formatter={(value) => {
                const v = typeof value === 'number' ? value : Number(value ?? 0)
                return [`${v} לקוחות`, '']
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0EA5E9"
              strokeWidth={3}
              dot={{ r: 4, fill: '#0EA5E9' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
