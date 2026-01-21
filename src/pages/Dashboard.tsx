import { Users, UserCheck, Calendar, TrendingUp } from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { dashboardStats } from '@/lib/mock-data'
import { formatPercent } from '@/lib/utils'
import { RecentLeadsTable } from '@/pages/parts/RecentLeadsTable'
import { StatCard } from '@/pages/parts/StatCard'

export function Dashboard() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">לוח בקרה</h1>
        <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">
          ברוכים הבאים למערכת הניהול של Robin
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <StatCard
          title="סה״כ לקוחות"
          value={dashboardStats.totalLeads}
          growth={dashboardStats.totalLeadsGrowth}
          icon={<AnimatedIcon icon={Users} size={22} variant="lift" />}
        />
        <StatCard
          title="לקוחות פעילים"
          value={dashboardStats.activeLeads}
          growth={dashboardStats.activeLeadsGrowth}
          icon={<AnimatedIcon icon={UserCheck} size={22} variant="wiggle" />}
        />
        <StatCard
          title="פגישות החודש"
          value={dashboardStats.monthlyMeetings}
          growth={dashboardStats.monthlyMeetingsGrowth}
          icon={<AnimatedIcon icon={Calendar} size={22} variant="spin" />}
        />
        <StatCard
          title="המרה לעסקאות"
          value={formatPercent(dashboardStats.conversionRate)}
          growth={dashboardStats.conversionRateGrowth}
          icon={<AnimatedIcon icon={TrendingUp} size={22} variant="pulse" />}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* לקוחות חדשים - תופס 2 עמודות */}
        <div className="lg:col-span-2">
          <RecentLeadsTable />
        </div>

        {/* פגישות קרובות */}
        <div className="rounded-2xl border border-[var(--color-border-light)] bg-white p-4 sm:p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-base sm:text-lg font-semibold text-[var(--color-text)]">פגישות קרובות</h3>
          <div className="mt-4 space-y-3">
            {[
              { name: 'דוד לוי', time: 'היום, 10:00', color: 'bg-[var(--color-primary)]' },
              { name: 'שרה כהן', time: 'היום, 14:30', color: 'bg-[var(--color-accent)]' },
              { name: 'משה אברהם', time: 'מחר, 11:00', color: 'bg-[var(--color-success)]' },
            ].map((m) => (
              <div key={m.name} className="flex items-center justify-between rounded-xl bg-[var(--color-background)] px-3 sm:px-4 py-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{m.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{m.time}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${m.color}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
