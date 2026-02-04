import { useEffect, useMemo, useState } from 'react'
import { Calendar, TrendingUp, UserCheck, Users } from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { RecentLeadsTable } from '@/pages/parts/RecentLeadsTable'
import { StatCard } from '@/pages/parts/StatCard'
import { useUsers } from '@/lib/users-store'
import { fetchMeetings, type MeetingItem } from '@/lib/meetings-api'
import { formatShortDate } from '@/lib/utils'
import type { LeadStatus } from '@/types'

const INACTIVE_LEAD_STATUSES: LeadStatus[] = ['קבלת הכסף', 'מחזור - אין הצעה', 'חוסר התאמה', 'סיום צ׳אט בהצלחה']

const isInMonth = (value: string, monthStart: Date, nextMonthStart: Date) => {
  const t = new Date(value).getTime()
  return t >= monthStart.getTime() && t < nextMonthStart.getTime()
}

const isSameDay = (a: Date, b: Date) => (
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
)

const formatTime = (value: Date) => new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
}).format(value)

const formatMeetingTime = (value: string) => {
  const date = new Date(value)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  if (isSameDay(date, today)) return `היום, ${formatTime(date)}`
  if (isSameDay(date, tomorrow)) return `מחר, ${formatTime(date)}`
  return `${formatShortDate(date)}, ${formatTime(date)}`
}

const calcGrowth = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : 100
  return Math.round(((current - previous) / previous) * 100)
}

export function Dashboard() {
  const { users } = useUsers()
  const [meetings, setMeetings] = useState<MeetingItem[]>([])

  useEffect(() => {
    let mounted = true
    const loadMeetings = async () => {
      try {
        const data = await fetchMeetings()
        if (mounted) setMeetings(data)
      } catch {
        if (mounted) setMeetings([])
      }
    }
    void loadMeetings()
    return () => {
      mounted = false
    }
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const isActiveLead = (status: LeadStatus) => !INACTIVE_LEAD_STATUSES.includes(status)

    const totalLeads = users.length
    const activeLeads = users.filter((lead) => isActiveLead(lead.status)).length

    const leadsThisMonth = users.filter((lead) => isInMonth(lead.createdAt, monthStart, nextMonthStart)).length
    const leadsPrevMonth = users.filter((lead) => isInMonth(lead.createdAt, prevMonthStart, monthStart)).length

    const activeLeadsThisMonth = users.filter((lead) => (
      isActiveLead(lead.status) && isInMonth(lead.createdAt, monthStart, nextMonthStart)
    )).length
    const activeLeadsPrevMonth = users.filter((lead) => (
      isActiveLead(lead.status) && isInMonth(lead.createdAt, prevMonthStart, monthStart)
    )).length

    const monthlyMeetings = meetings.filter((meeting) => (
      meeting.status !== 'בוטל' && isInMonth(meeting.start_at, monthStart, nextMonthStart)
    )).length
    const monthlyMeetingsPrev = meetings.filter((meeting) => (
      meeting.status !== 'בוטל' && isInMonth(meeting.start_at, prevMonthStart, monthStart)
    )).length

    return {
      totalLeads,
      totalLeadsGrowth: calcGrowth(leadsThisMonth, leadsPrevMonth),
      activeLeads,
      activeLeadsGrowth: calcGrowth(activeLeadsThisMonth, activeLeadsPrevMonth),
      monthlyMeetings,
      monthlyMeetingsGrowth: calcGrowth(monthlyMeetings, monthlyMeetingsPrev),
    }
  }, [users, meetings])

  const upcomingMeetings = useMemo(() => {
    const colors = ['bg-[var(--color-primary)]', 'bg-[var(--color-accent)]', 'bg-[var(--color-success)]']
    const now = Date.now()
    const userMap = new Map(users.map((user) => [user.id, `${user.firstName} ${user.lastName}`.trim()]))

    return meetings
      .filter((meeting) => meeting.status !== 'בוטל' && new Date(meeting.start_at).getTime() >= now)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 3)
      .map((meeting, index) => ({
        id: meeting.id,
        name: userMap.get(meeting.user_id) || meeting.title || 'לקוח',
        time: formatMeetingTime(meeting.start_at),
        color: colors[index % colors.length],
      }))
  }, [meetings, users])

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
          value={stats.totalLeads}
          growth={stats.totalLeadsGrowth}
          icon={<AnimatedIcon icon={Users} size={22} variant="lift" />}
        />
        <StatCard
          title="לקוחות פעילים"
          value={stats.activeLeads}
          growth={stats.activeLeadsGrowth}
          icon={<AnimatedIcon icon={UserCheck} size={22} variant="wiggle" />}
        />
        <StatCard
          title="פגישות החודש"
          value={stats.monthlyMeetings}
          growth={stats.monthlyMeetingsGrowth}
          icon={<AnimatedIcon icon={Calendar} size={22} variant="spin" />}
        />
        <StatCard
          title="המרה לעסקאות"
          value="—"
          growth={null}
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
            {upcomingMeetings.map((meeting) => (
              <div key={meeting.id} className="flex items-center justify-between rounded-xl bg-[var(--color-background)] px-3 sm:px-4 py-3">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{meeting.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{meeting.time}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${meeting.color}`} />
              </div>
            ))}
            {upcomingMeetings.length === 0 && (
              <div className="rounded-xl bg-[var(--color-background)] px-3 sm:px-4 py-3 text-sm text-[var(--color-text-muted)]">
                אין פגישות קרובות
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
