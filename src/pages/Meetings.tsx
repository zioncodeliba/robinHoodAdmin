import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, SlidersHorizontal, X, Clock, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { fetchMeetingAvailability, updateMeetingAvailability, type AvailabilityDay, type DateException, type TimeRange } from '@/lib/meeting-availability-api'
import { useUsers } from '@/lib/users-store'
import { useMessages } from '@/lib/messages-store'
import { createNotificationForUser, type NotificationItem } from '@/lib/notifications-api'
import { formatShortDate } from '@/lib/utils'
import { createMeeting as createMeetingRequest, deleteMeeting, fetchMeetings, type MeetingItem } from '@/lib/meetings-api'
import type { CalendarView, Meeting, MeetingStatus, MessageTemplateTrigger, SentMessage } from '@/types'

// Israeli holidays for 2024-2025 (Hebrew calendar dates converted)
const israeliHolidays: { date: string; name: string }[] = [
  // 2024
  { date: '2024-10-03', name: 'ראש השנה' },
  { date: '2024-10-04', name: 'ראש השנה ב׳' },
  { date: '2024-10-12', name: 'יום כיפור' },
  { date: '2024-10-17', name: 'סוכות' },
  { date: '2024-10-24', name: 'שמחת תורה' },
  { date: '2024-12-26', name: 'חנוכה (יום א׳)' },
  // 2025
  { date: '2025-03-14', name: 'פורים' },
  { date: '2025-04-13', name: 'פסח (יום א׳)' },
  { date: '2025-04-19', name: 'פסח (יום ז׳)' },
  { date: '2025-05-01', name: 'יום העצמאות' },
  { date: '2025-06-02', name: 'שבועות' },
  { date: '2025-09-23', name: 'ראש השנה' },
  { date: '2025-09-24', name: 'ראש השנה ב׳' },
  { date: '2025-10-02', name: 'יום כיפור' },
  { date: '2025-10-07', name: 'סוכות' },
  { date: '2025-10-14', name: 'שמחת תורה' },
]

function startOfWeekSunday(d: Date) {
  const date = new Date(d)
  const day = date.getDay() // 0=Sun
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day)
  return date
}

function startOfMonth(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date
}

function endOfMonth(d: Date) {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setMonth(date.getMonth() + 1, 0)
  return date
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function addMonths(d: Date, months: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + months)
  return x
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function fmtDayHeader(d: Date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: '2-digit' }).format(d)
}

function fmtRange(from: Date, to: Date) {
  const f = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: 'short' }).format(from)
  const t = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: 'short', year: 'numeric' }).format(to)
  return `${f} - ${t}`
}

function fmtDayLabel(d: Date) {
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(d)
}

function fmtMonthLabel(d: Date) {
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d)
}

function toMinutes(t: string) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function isoForDateTime(day: Date, time: string) {
  const [hh, mm] = time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

const statusLabel: Record<MeetingStatus, string> = {
  'מאושר': 'מאושר',
  'ממתין': 'ממתין',
  'בוטל': 'בוטל',
}

const statusPill: Record<MeetingStatus, string> = {
  'מאושר': 'bg-green-100 text-green-700',
  'ממתין': 'bg-amber-100 text-amber-700',
  'בוטל': 'bg-red-100 text-red-700',
}

const dayDefs = [
  { dayIndex: 0, short: 'א׳', label: 'יום א׳' },
  { dayIndex: 1, short: 'ב׳', label: 'יום ב׳' },
  { dayIndex: 2, short: 'ג׳', label: 'יום ג׳' },
  { dayIndex: 3, short: 'ד׳', label: 'יום ד׳' },
  { dayIndex: 4, short: 'ה׳', label: 'יום ה׳' },
  { dayIndex: 5, short: 'ו׳', label: 'יום ו׳' },
  { dayIndex: 6, short: 'ש׳', label: 'שבת' },
] as const

const buildDefaultAvailability = (): AvailabilityDay[] =>
  dayDefs.map((d) => ({
    enabled: d.dayIndex !== 6,
    ranges: [{ start: '09:00', end: '17:00' }],
  }))

const ADMIN_MEETING_TEMPLATE_TRIGGER: MessageTemplateTrigger = 'אדמין - קביעת פגישה'

const mapNotificationToSentMessage = (item: NotificationItem): SentMessage => ({
  id: item.id,
  templateId: item.template_id ?? '',
  templateName: item.template_name ?? 'עדכון',
  message: item.message,
  sentAt: item.sent_at,
  readAt: item.read_at ?? undefined,
})

const buildMeetingDetailsText = (startIso: string, endIso: string, notes?: string) => {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `יום: —\nתאריך: —\nשעה: —\nהערות: ${notes?.trim() || 'ללא הערות'}`
  }

  const dayLabel = start.toLocaleDateString('he-IL', { weekday: 'long' })
  const dateLabel = start.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const startTime = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  const notesLabel = notes?.trim() ? notes.trim() : 'ללא הערות'

  return `יום: ${dayLabel}\nתאריך: ${dateLabel}\nשעה: ${startTime} - ${endTime}\nהערות: ${notesLabel}`
}

const buildTemplateMessage = (
  templateMessage: string,
  firstName: string,
  lastName: string,
  meetingDetailsText: string
) =>
  templateMessage
    .replace(/\{שם\}/g, `${firstName} ${lastName}`.trim())
    .replace(/\{פרטי פגישה\}/g, meetingDetailsText)
    .replace(/\{פרטי_פגישה\}/g, meetingDetailsText)

export function Meetings() {
  const { users, updateUser } = useUsers()
  const { templates } = useMessages()

  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [newOpen, setNewOpen] = useState(false)
  const [availabilityOpen, setAvailabilityOpen] = useState(false)
  const [activeMeeting, setActiveMeeting] = useState<Meeting | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [hoveredMeetingId, setHoveredMeetingId] = useState<string | null>(null)

  const [meetingItems, setMeetingItems] = useState<MeetingItem[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const [meetingSaving, setMeetingSaving] = useState(false)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)

  const [availability, setAvailability] = useState<AvailabilityDay[]>(() => buildDefaultAvailability())

  const [blockHolidays, setBlockHolidays] = useState(true)
  const [agentCount, setAgentCount] = useState(1)
  const [exceptions, setExceptions] = useState<DateException[]>([])
  const [exceptionOpen, setExceptionOpen] = useState(false)
  const [exceptionForm, setExceptionForm] = useState({
    date: '',
    type: 'block' as 'block' | 'open',
    allDay: true,
    ranges: [{ start: '09:00', end: '17:00' }] as TimeRange[],
    reason: '',
  })

  const weekStart = useMemo(() => startOfWeekSunday(anchorDate), [anchorDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate])
  const monthEnd = useMemo(() => endOfMonth(anchorDate), [anchorDate])
  const monthDays = useMemo(() => {
    const days: Date[] = []
    const firstWeekStart = startOfWeekSunday(monthStart)
    let current = firstWeekStart
    while (current <= monthEnd || days.length % 7 !== 0) {
      days.push(new Date(current))
      current = addDays(current, 1)
      if (days.length > 42) break
    }
    return days
  }, [monthStart, monthEnd])

  const rangeLabel = useMemo(() => {
    if (view === 'day') return fmtDayLabel(anchorDate)
    if (view === 'month') return fmtMonthLabel(anchorDate)
    return fmtRange(weekDays[0], weekDays[6])
  }, [view, anchorDate, weekDays])

  const dayStartMin = 8 * 60
  const dayEndMin = 19 * 60
  const pxPerMin = 1.1
  const gridHeight = (dayEndMin - dayStartMin) * pxPerMin

  // Check if a date is a holiday
  const isHoliday = (dateKey: string) => {
    if (!blockHolidays) return null
    return israeliHolidays.find((h) => h.date === dateKey) ?? null
  }

  // Check if a date has an exception
  const getException = (dateKey: string) => {
    return exceptions.find((e) => e.date === dateKey) ?? null
  }

  // Check if date is blocked (holiday or full-day block exception)
  const isDateBlocked = (dateKey: string) => {
    const holiday = isHoliday(dateKey)
    if (holiday) return { blocked: true, reason: holiday.name }
    const exc = getException(dateKey)
    if (exc?.type === 'block' && exc.allDay) return { blocked: true, reason: exc.reason }
    return null
  }

  const meetingStatusFallback = (value: string): MeetingStatus => {
    const allowed: MeetingStatus[] = ['מאושר', 'ממתין', 'בוטל']
    return allowed.includes(value as MeetingStatus) ? (value as MeetingStatus) : 'ממתין'
  }

  const normalizeApiDate = (value: string) => {
    const trimmed = value.trim()
    const hasTimezone = /[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)
    return hasTimezone ? trimmed : `${trimmed}Z`
  }

  const mapMeeting = (item: MeetingItem): Meeting => {
    const user = users.find((u) => u.id === item.user_id)
    return {
      id: item.id,
      title: item.title,
      userId: item.user_id,
      userName: user ? `${user.firstName} ${user.lastName}` : 'לקוח לא ידוע',
      start: normalizeApiDate(item.start_at),
      end: normalizeApiDate(item.end_at),
      status: meetingStatusFallback(item.status),
      notes: item.notes ?? undefined,
    }
  }

  const meetings = useMemo(() => meetingItems.map(mapMeeting), [meetingItems, users])

  const visibleMeetings = useMemo(() => {
    if (view === 'day') {
      return meetings.filter((m) => sameDay(new Date(m.start), anchorDate))
    }
    if (view === 'month') {
      return meetings.filter((m) => {
        const s = new Date(m.start)
        return monthDays.some((d) => sameDay(d, s))
      })
    }
    return meetings.filter((m) => {
      const s = new Date(m.start)
      return weekDays.some((d) => sameDay(d, s))
    })
  }, [meetings, view, weekDays, monthDays, anchorDate])

  const agendaMeetings = useMemo(() => {
    return [...visibleMeetings].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [visibleMeetings])

  // Calculate overlap info for meetings (for stacking/positioning)
  const getMeetingOverlapInfo = (meeting: Meeting, dayMeetings: Meeting[]) => {
    const mStart = new Date(meeting.start)
    const mEnd = new Date(meeting.end)
    const mStartMin = mStart.getHours() * 60 + mStart.getMinutes()
    const mEndMin = mEnd.getHours() * 60 + mEnd.getMinutes()
    
    // Find all meetings that overlap with this one
    const overlapping = dayMeetings.filter((other) => {
      if (other.id === meeting.id) return false
      const oStart = new Date(other.start)
      const oEnd = new Date(other.end)
      const oStartMin = oStart.getHours() * 60 + oStart.getMinutes()
      const oEndMin = oEnd.getHours() * 60 + oEnd.getMinutes()
      // Check if times overlap
      return !(mEndMin <= oStartMin || mStartMin >= oEndMin)
    })
    
    if (overlapping.length === 0) {
      return { hasOverlap: false, index: 0, total: 1 }
    }
    
    // Sort all overlapping meetings by start time, then by id for consistency
    const allOverlapping = [meeting, ...overlapping].sort((a, b) => {
      const aStart = new Date(a.start).getTime()
      const bStart = new Date(b.start).getTime()
      if (aStart !== bStart) return aStart - bStart
      return a.id.localeCompare(b.id)
    })
    
    const index = allOverlapping.findIndex((m) => m.id === meeting.id)
    return { hasOverlap: true, index, total: allOverlapping.length }
  }

  const [form, setForm] = useState({
    userId: users[0]?.id ?? '',
    title: 'פגישה חדשה',
    date: new Date().toISOString().slice(0, 10),
    startTime: '10:00',
    endTime: '10:30',
    status: 'ממתין' as MeetingStatus,
    notes: '',
  })

  const selectedUser = users.find((u) => u.id === form.userId) ?? null

  useEffect(() => {
    if (!form.userId && users.length > 0) {
      setForm((prev) => ({ ...prev, userId: users[0].id }))
    }
  }, [users, form.userId])

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        setMeetingsLoading(true)
        const data = await fetchMeetings()
        if (isActive) {
          setMeetingItems(data)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת פגישות')
      } finally {
        if (isActive) {
          setMeetingsLoading(false)
        }
      }
    }
    void load()
    return () => {
      isActive = false
    }
  }, [])

  const loadAvailability = useCallback(async () => {
    try {
      setAvailabilityLoading(true)
      const data = await fetchMeetingAvailability()
      const normalizedAvailability = Array.isArray(data.availability) && data.availability.length > 0
        ? data.availability
        : buildDefaultAvailability()
      setAvailability(normalizedAvailability)
      setExceptions(Array.isArray(data.exceptions) ? data.exceptions : [])
      setAgentCount(Math.max(1, data.agent_count || 1))
      setBlockHolidays(data.block_holidays ?? true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בטעינת זמינות')
    } finally {
      setAvailabilityLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAvailability()
  }, [loadAvailability])

  const saveAvailability = async () => {
    try {
      setAvailabilitySaving(true)
      const updated = await updateMeetingAvailability({
        availability,
        exceptions,
        agent_count: agentCount,
        block_holidays: blockHolidays,
      })
      const normalizedAvailability = Array.isArray(updated.availability) && updated.availability.length > 0
        ? updated.availability
        : buildDefaultAvailability()
      setAvailability(normalizedAvailability)
      setExceptions(Array.isArray(updated.exceptions) ? updated.exceptions : [])
      setAgentCount(Math.max(1, updated.agent_count || 1))
      setBlockHolidays(updated.block_holidays ?? true)
      toast.success('הזמינות נשמרה')
      setAvailabilityOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת זמינות')
    } finally {
      setAvailabilitySaving(false)
    }
  }

  const createMeeting = async () => {
    if (!selectedUser) {
      toast.error('בחרו לקוח לפגישה')
      return
    }
    if (!form.date) {
      toast.error('בחרו תאריך לפגישה')
      return
    }

    // Check holidays
    const holiday = isHoliday(form.date)
    if (holiday) {
      toast.error(`לא ניתן לקבוע פגישה ב${holiday.name}`)
      return
    }

    // Check blocked exceptions
    const blocked = isDateBlocked(form.date)
    if (blocked) {
      toast.error(`התאריך חסום: ${blocked.reason}`)
      return
    }

    const startM = toMinutes(form.startTime)
    const endM = toMinutes(form.endTime)
    if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
      toast.error('שעות לא תקינות. ודאו ש"שעה עד" מאוחרת מ"שעה מ".')
      return
    }

    const date = new Date(form.date)
    const dayIdx = date.getDay()
    const dayAvail = availability[dayIdx]
    
    // Check if there's an "open" exception for this date
    const openExc = exceptions.find((e) => e.date === form.date && e.type === 'open')
    
    if (!dayAvail?.enabled && !openExc) {
      toast.error('אין זמינות ביום שנבחר. עדכנו זמינות או בחרו יום אחר.')
      return
    }

    // Use exception hours if exists, otherwise use regular availability
    const firstRange = dayAvail.ranges[0]
    const excFirstRange = openExc?.ranges[0]
    const availStart = excFirstRange ? toMinutes(excFirstRange.start) : toMinutes(firstRange?.start ?? '09:00')
    const availEnd = excFirstRange ? toMinutes(excFirstRange.end) : toMinutes(firstRange?.end ?? '17:00')
    
    if (startM < availStart || endM > availEnd) {
      const startStr = excFirstRange?.start ?? firstRange?.start ?? '09:00'
      const endStr = excFirstRange?.end ?? firstRange?.end ?? '17:00'
      toast.error(`השעות חורגות מהזמינות (${startStr}–${endStr}).`)
      return
    }

    // Check time-specific block exceptions
    const blockExc = exceptions.find((e) => e.date === form.date && e.type === 'block' && !e.allDay && e.ranges.length > 0)
    if (blockExc) {
      for (const range of blockExc.ranges) {
        const blockStart = toMinutes(range.start)
        const blockEnd = toMinutes(range.end)
        if (!(endM <= blockStart || startM >= blockEnd)) {
          toast.error(`השעות חוסמות עם החרגה: ${blockExc.reason} (${range.start}–${range.end})`)
          return
        }
      }
    }

    // Check concurrent meetings against agent count
    const concurrentMeetings = meetings.filter((m) => {
      const mStart = toMinutes(new Date(m.start).toTimeString().slice(0, 5))
      const mEnd = toMinutes(new Date(m.end).toTimeString().slice(0, 5))
      const mDate = new Date(m.start).toISOString().slice(0, 10)
      // Check if same date and times overlap
      if (mDate !== form.date) return false
      return !(endM <= mStart || startM >= mEnd)
    })
    
    if (concurrentMeetings.length >= agentCount) {
      toast.error(`כבר קיימות ${agentCount} פגישות במקביל בשעה זו (מקסימום סוכנים: ${agentCount})`)
      return
    }

    const start = isoForDateTime(date, form.startTime)
    const end = isoForDateTime(date, form.endTime)
    try {
      setMeetingSaving(true)
      const created = await createMeetingRequest({
        user_id: form.userId,
        title: form.title.trim() || 'פגישה',
        start_at: start,
        end_at: end,
        status: form.status,
        notes: form.notes.trim() || null,
      })
      setMeetingItems((prev) => [created, ...prev])
      const meetingTemplate = templates.find((template) => template.trigger === ADMIN_MEETING_TEMPLATE_TRIGGER)
      if (meetingTemplate) {
        try {
          const meetingDetailsText = buildMeetingDetailsText(start, end, form.notes)
          const savedNotification = await createNotificationForUser(selectedUser.id, {
            message: buildTemplateMessage(
              meetingTemplate.message,
              selectedUser.firstName,
              selectedUser.lastName,
              meetingDetailsText
            ),
            templateId: meetingTemplate.id,
            templateName: meetingTemplate.name,
          })
          const mappedNotification = mapNotificationToSentMessage(savedNotification)
          updateUser(selectedUser.id, {
            sentMessages: [mappedNotification, ...(selectedUser.sentMessages || [])],
          })
        } catch (notificationError) {
          const detail =
            notificationError instanceof Error && notificationError.message
              ? ` (${notificationError.message})`
              : ''
          toast.error(`הפגישה נוספה, אך שליחת הודעת תבנית נכשלה${detail}`)
        }
      } else {
        toast.warning('הפגישה נוספה, אך לא נמצאה תבנית עם טריגר "אדמין - קביעת פגישה"')
      }
      toast.success('הפגישה נוספה')
      setNewOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהוספת פגישה')
    } finally {
      setMeetingSaving(false)
    }
  }

  const addException = () => {
    if (!exceptionForm.date) {
      toast.error('בחרו תאריך')
      return
    }
    const exc: DateException = {
      id: `exc-${Date.now()}`,
      date: exceptionForm.date,
      type: exceptionForm.type,
      allDay: exceptionForm.allDay,
      ranges: exceptionForm.allDay ? [] : exceptionForm.ranges.filter((r) => r.start && r.end),
      reason: exceptionForm.reason.trim() || (exceptionForm.type === 'block' ? 'חסום' : 'פתוח'),
    }
    setExceptions((prev) => [exc, ...prev])
    toast.success('החרגה נוספה')
    setExceptionOpen(false)
    setExceptionForm({ date: '', type: 'block', allDay: true, ranges: [{ start: '09:00', end: '17:00' }], reason: '' })
  }

  const navigate = (dir: -1 | 1) => {
    if (view === 'day') setAnchorDate((d) => addDays(d, dir))
    else if (view === 'week') setAnchorDate((d) => addDays(d, dir * 7))
    else setAnchorDate((d) => addMonths(d, dir))
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-right">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">פגישות</h1>
          <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">ניהול פגישות במבנה יומן</p>
        </div>

        <div className="flex flex-row gap-2 sm:flex-row-reverse sm:items-center">
          <Button
            variant="outline"
            onClick={() => setAvailabilityOpen(true)}
            className="h-10 w-10 sm:h-11 sm:w-11 px-0"
            aria-label="הגדרות זמינות"
            title="הגדרות זמינות"
          >
            <AnimatedIcon icon={SlidersHorizontal} size={18} variant="lift" />
          </Button>
          <Button variant="accent" onClick={() => setNewOpen(true)} className="flex-1 sm:flex-none">
            <AnimatedIcon icon={Plus} size={18} variant="lift" />
            פגישה חדשה
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
            <div className="inline-flex items-center gap-1 sm:gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2 sm:px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="h-8 w-8 sm:h-9 sm:w-9 px-0"
              >
                <AnimatedIcon icon={ChevronRight} size={18} variant="lift" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnchorDate(new Date())}
                className="text-xs sm:text-sm"
              >
                היום
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(1)}
                className="h-8 w-8 sm:h-9 sm:w-9 px-0"
              >
                <AnimatedIcon icon={ChevronLeft} size={18} variant="lift" />
              </Button>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 sm:px-4 py-2">
              <AnimatedIcon icon={CalendarDays} size={18} variant="spin" className="text-[var(--color-text-muted)]" />
              <span className="text-xs sm:text-sm text-[var(--color-text)]">{rangeLabel}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
            <DropdownSelect<CalendarView>
              value={view}
              onChange={setView}
              options={[
                { value: 'day', label: 'יום' },
                { value: 'week', label: 'שבוע' },
                { value: 'month', label: 'חודש' },
              ]}
              buttonClassName="min-w-[120px] sm:min-w-[160px] justify-between bg-[var(--color-background)]"
              contentAlign="end"
            />
          </div>
        </div>
      </div>

      {/* Mobile Agenda View */}
      <div className="block lg:hidden space-y-3">
        {meetingsLoading ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
            טוען פגישות...
          </div>
        ) : agendaMeetings.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
            {view === 'day' ? 'אין פגישות היום' : view === 'week' ? 'אין פגישות השבוע' : 'אין פגישות החודש'}
          </div>
        ) : (
          agendaMeetings.map((m) => {
            const s = new Date(m.start)
            const e = new Date(m.end)
            return (
              <div
                key={m.id}
                className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setActiveMeeting(m)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--color-text)]">{m.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{m.userName}</p>
                  </div>
                  <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[m.status]}`}>
                    {statusLabel[m.status]}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
                  <div className="flex items-center gap-1">
                    <AnimatedIcon icon={CalendarDays} size={14} variant="lift" />
                    <span>{formatShortDate(m.start)}</span>
                  </div>
                  <div className="flex items-center gap-1" dir="ltr">
                    <AnimatedIcon icon={Clock} size={14} variant="lift" />
                    <span>
                      {s.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
                {m.notes ? (
                  <p className="mt-2 text-xs text-[var(--color-text-muted)] line-clamp-2">{m.notes}</p>
                ) : null}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop Day View */}
      {view === 'day' && (
        <div className="hidden lg:block rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
          <div className="flex border-b border-[var(--color-border-light)]">
            <div className="flex-1 px-4 py-4 text-right">
              <div className="text-base font-bold text-[var(--color-text)]">{fmtDayLabel(anchorDate)}</div>
              {(() => {
                const holiday = isHoliday(toDateKey(anchorDate))
                const blocked = isDateBlocked(toDateKey(anchorDate))
                if (holiday) return <div className="mt-1 text-sm text-[var(--color-danger)]">חג: {holiday.name}</div>
                if (blocked) return <div className="mt-1 text-sm text-[var(--color-danger)]">{blocked.reason}</div>
                return null
              })()}
            </div>
            <div className="w-[84px] border-l border-[var(--color-border-light)] px-3 py-4 text-right text-xs text-[var(--color-text-muted)]">
              GMT +2
            </div>
          </div>

          <div className="flex" dir="ltr">
            <div className="flex-1 relative">
              {/* Day availability overlay */}
              {(() => {
                const dateKey = toDateKey(anchorDate)
                const holiday = isHoliday(dateKey)
                const blocked = isDateBlocked(dateKey)
                const dayIdx = anchorDate.getDay()
                const dayAvail = availability[dayIdx]
                const openExc = exceptions.find((e) => e.date === dateKey && e.type === 'open')
                const isAvailable = (dayAvail?.enabled || openExc) && !holiday && !blocked
                
                if (isAvailable) {
                  const firstRange = dayAvail?.ranges?.[0]
                  const excFirstRange = openExc?.ranges?.[0]
                  const availStart = excFirstRange ? toMinutes(excFirstRange.start) : (firstRange?.start ? toMinutes(firstRange.start) : dayStartMin)
                  const availEnd = excFirstRange ? toMinutes(excFirstRange.end) : (firstRange?.end ? toMinutes(firstRange.end) : dayEndMin)
                  const availTop = clamp((availStart - dayStartMin) * pxPerMin, 0, gridHeight)
                  const availHeight = clamp((availEnd - availStart) * pxPerMin, 0, gridHeight - availTop)
                  
                  return (
                    <div
                      className="absolute inset-x-0 bg-green-50 border-l-2 border-green-400 pointer-events-none"
                      style={{ top: availTop, height: availHeight }}
                    />
                  )
                }
                return null
              })()}
              
              <div style={{ height: gridHeight }} className="relative">
                {Array.from({ length: 12 }, (_, i) => (
                  <div
                    key={i}
                    className="border-b border-dashed border-[var(--color-border-light)]"
                    style={{ height: 60 * pxPerMin }}
                  />
                ))}
              </div>

              <div className="pointer-events-none absolute inset-0">
                {visibleMeetings.map((m) => {
                  const s = new Date(m.start)
                  const e = new Date(m.end)
                  const timeStart = s.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  const timeEnd = e.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                  const timeRange = `${timeStart} - ${timeEnd}`
                  const timeRangeCompact = `${timeStart}-${timeEnd}`
                  const top = clamp(((s.getHours() * 60 + s.getMinutes()) - dayStartMin) * pxPerMin, 0, gridHeight)
                  const durationPx =
                    ((e.getHours() * 60 + e.getMinutes()) - (s.getHours() * 60 + s.getMinutes())) * pxPerMin
                  const height = clamp(durationPx, 24, 420)
                  const compact = height < 96
                  const tiny = height < 64
                  const micro = height < 44
                  const cardPadding = micro ? 'p-0.5' : tiny ? 'p-1' : compact ? 'p-1.5' : 'p-2.5'
                  const gapClass = micro ? 'gap-0' : compact ? 'gap-0.5' : 'gap-1'
                  const rowGapClass = micro ? 'gap-1' : 'gap-1.5'
                  const titleClass = micro ? 'text-[10px] leading-[1.1]' : compact ? 'text-xs' : 'text-sm'
                  const titleClamp = compact ? 'line-clamp-1' : 'line-clamp-2'
                  const metaClass = micro ? 'text-[9px] leading-[1.1]' : compact ? 'text-[10px]' : 'text-xs'
                  const pillClass = micro ? 'text-[7px] leading-none' : compact ? 'text-[8px]' : 'text-[9px]'
                  const pillPaddingClass = micro ? 'px-1 py-0' : 'px-1.5 py-0.5'
                  const showMeta = height >= 32
                  const useCompactMeta = height < 56
                  
                  // Calculate overlap positioning
                  const { hasOverlap, index, total } = getMeetingOverlapInfo(m, visibleMeetings)
                  const isHovered = hoveredMeetingId === m.id
                  const baseZIndex = hasOverlap ? 10 + index : 1
                  const zIndex = isHovered ? 100 : baseZIndex
                  
                  // Calculate width and left offset for overlapping meetings
                  const widthPercent = hasOverlap ? 85 / total : 100
                  const leftOffset = hasOverlap ? index * (70 / total) : 0
                  
                  return (
                    <div
                      key={m.id}
                      className={`pointer-events-auto absolute rounded-2xl border border-[var(--color-border)] bg-white shadow-sm cursor-pointer transition-all duration-300 ease-out overflow-hidden ${cardPadding} ${
                        isHovered ? 'shadow-xl scale-[1.02] border-[var(--color-primary)]' : 'hover:shadow-md'
                      }`}
                      style={{
                        top,
                        height,
                        zIndex,
                        left: hasOverlap ? `calc(${leftOffset}% + 12px)` : '12px',
                        right: hasOverlap ? 'auto' : '12px',
                        width: hasOverlap ? `${widthPercent}%` : 'auto',
                      }}
                      onClick={() => setActiveMeeting(m)}
                      onMouseEnter={() => setHoveredMeetingId(m.id)}
                      onMouseLeave={() => setHoveredMeetingId(null)}
                    >
                      <div dir="rtl" className={`flex flex-col text-right overflow-hidden ${gapClass}`}>
                        <div className={`flex flex-row-reverse items-start ${rowGapClass}`}>
                          <span className={`shrink-0 inline-flex rounded-full font-semibold ${pillPaddingClass} ${pillClass} ${statusPill[m.status]}`}>
                            {statusLabel[m.status]}
                          </span>
                          <span className={`flex-1 min-w-0 font-bold leading-tight text-[var(--color-text)] ${titleClass} ${titleClamp}`}>
                            {m.title}
                          </span>
                        </div>
                        {showMeta && useCompactMeta ? (
                          <div className={`flex items-center gap-1 ${metaClass} text-[var(--color-text-muted)]`}>
                            <span className="min-w-0 flex-1 truncate">{m.userName}</span>
                            <span dir="ltr" className="shrink-0">{timeRangeCompact}</span>
                          </div>
                        ) : showMeta ? (
                          <>
                            <div className={`${metaClass} text-[var(--color-text-muted)] truncate`}>{m.userName}</div>
                            <div dir="ltr" className={`${metaClass} text-[var(--color-text-muted)]`}>
                              {timeRange}
                            </div>
                          </>
                        ) : null}
                        {!compact && m.notes && !hasOverlap ? (
                          <div className="mt-1 text-[11px] leading-tight text-[var(--color-text-muted)] line-clamp-2">
                            {m.notes}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="w-[84px] border-l border-[var(--color-border-light)]">
              {Array.from({ length: 12 }, (_, i) => {
                const hour = 8 + i
                return (
                  <div
                    key={hour}
                    className="relative px-3 text-right text-xs text-[var(--color-text-muted)]"
                    style={{ height: 60 * pxPerMin }}
                    dir="rtl"
                  >
                    <div className="sticky top-0 pt-2">{hour}:00</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Week View */}
      {view === 'week' && (
        <div className="hidden lg:block rounded-3xl border border-[var(--color-border)] bg-white shadow-sm">
          {/* Header row */}
          <div className="grid grid-cols-[repeat(7,1fr)_84px] border-b border-[var(--color-border-light)]" dir="ltr">
            {[...weekDays].map((d, i) => {
              const dateKey = toDateKey(d)
              const holiday = isHoliday(dateKey)
              const blocked = isDateBlocked(dateKey)
              return (
                <div
                  key={d.toISOString()}
                  className={`px-3 py-4 ${i === 0 ? '' : 'border-l border-[var(--color-border-light)]'} ${holiday || blocked ? 'bg-red-50' : ''}`}
                >
                  <div dir="rtl" className="text-right text-xs font-semibold text-[var(--color-text-muted)]">
                    {fmtDayHeader(d)}
                  </div>
                  {holiday ? (
                    <div dir="rtl" className="text-right text-[10px] text-[var(--color-danger)] mt-1">{holiday.name}</div>
                  ) : blocked ? (
                    <div dir="rtl" className="text-right text-[10px] text-[var(--color-danger)] mt-1">{blocked.reason}</div>
                  ) : null}
                </div>
              )
            })}
            <div className="border-l border-[var(--color-border-light)] px-3 py-4 text-right text-xs text-[var(--color-text-muted)]" dir="rtl">
              GMT +2
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[repeat(7,1fr)_84px]" dir="ltr">
            {weekDays.map((day, idx) => {
              const dateKey = toDateKey(day)
              const holiday = isHoliday(dateKey)
              const blocked = isDateBlocked(dateKey)
              const dayMeetings = visibleMeetings.filter((m) => sameDay(new Date(m.start), day))
              const dayIdx = day.getDay()
              const dayAvail = availability[dayIdx]
              const openExc = exceptions.find((e) => e.date === dateKey && e.type === 'open')
              const isAvailable = (dayAvail?.enabled || openExc) && !holiday && !blocked
              
              // Calculate availability bar position
              const firstRange = dayAvail?.ranges?.[0]
              const excFirstRange = openExc?.ranges?.[0]
              const availStart = excFirstRange ? toMinutes(excFirstRange.start) : (firstRange?.start ? toMinutes(firstRange.start) : dayStartMin)
              const availEnd = excFirstRange ? toMinutes(excFirstRange.end) : (firstRange?.end ? toMinutes(firstRange.end) : dayEndMin)
              const availTop = clamp((availStart - dayStartMin) * pxPerMin, 0, gridHeight)
              const availHeight = clamp((availEnd - availStart) * pxPerMin, 0, gridHeight - availTop)
              
              return (
                <div
                  key={day.toISOString()}
                  className={`relative ${idx === 0 ? '' : 'border-l border-[var(--color-border-light)]'} ${holiday || blocked ? 'bg-red-50/50' : ''}`}
                >
                  {/* Availability overlay */}
                  {isAvailable && (
                    <div
                      className="absolute inset-x-0 bg-green-50 border-l-2 border-green-400 pointer-events-none"
                      style={{ top: availTop, height: availHeight }}
                    />
                  )}
                  
                  <div style={{ height: gridHeight }} className="relative">
                    {Array.from({ length: 12 }, (_, i) => (
                      <div
                        key={i}
                        className="border-b border-dashed border-[var(--color-border-light)]"
                        style={{ height: 60 * pxPerMin }}
                      />
                    ))}
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    {dayMeetings.map((m) => {
                      const s = new Date(m.start)
                      const e = new Date(m.end)
                      const timeStart = s.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                      const timeEnd = e.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
                      const timeRange = `${timeStart} - ${timeEnd}`
                      const timeRangeCompact = `${timeStart}-${timeEnd}`
                      const top = clamp(((s.getHours() * 60 + s.getMinutes()) - dayStartMin) * pxPerMin, 0, gridHeight)
                      const durationPx =
                        ((e.getHours() * 60 + e.getMinutes()) - (s.getHours() * 60 + s.getMinutes())) * pxPerMin
                      const height = clamp(durationPx, 24, 420)
                      const compact = height < 88
                      const tiny = height < 56
                      const micro = height < 40
                      const cardPadding = micro ? 'p-0.5' : tiny ? 'p-1' : compact ? 'p-1.5' : 'p-2'
                      const gapClass = micro ? 'gap-0' : compact ? 'gap-0.5' : 'gap-1'
                      const rowGapClass = micro ? 'gap-0.5' : 'gap-1'
                      const titleClass = micro ? 'text-[9px] leading-[1.1]' : compact ? 'text-[11px]' : 'text-xs'
                      const titleClamp = compact ? 'line-clamp-1' : 'line-clamp-2'
                      const metaClass = micro ? 'text-[8px] leading-[1.1]' : compact ? 'text-[9px]' : 'text-[10px]'
                      const pillClass = micro ? 'text-[6px] leading-none' : compact ? 'text-[7px]' : 'text-[8px]'
                      const pillPaddingClass = micro ? 'px-1 py-0' : 'px-1.5 py-0.5'
                      const showMeta = height >= 30
                      const useCompactMeta = height < 48
                      
                      // Calculate overlap positioning
                      const { hasOverlap, index, total } = getMeetingOverlapInfo(m, dayMeetings)
                      const isHovered = hoveredMeetingId === m.id
                      const baseZIndex = hasOverlap ? 10 + index : 1
                      const zIndex = isHovered ? 100 : baseZIndex
                      
                      // Calculate width and left offset for overlapping meetings (narrower in week view)
                      const widthPercent = hasOverlap ? 80 / total : 100
                      const leftOffset = hasOverlap ? index * (60 / total) : 0
                      
                      return (
                        <div
                          key={m.id}
                          className={`pointer-events-auto absolute rounded-2xl border border-[var(--color-border)] bg-white shadow-sm cursor-pointer transition-all duration-300 ease-out overflow-hidden ${cardPadding} ${
                            isHovered ? 'shadow-xl scale-[1.03] border-[var(--color-primary)]' : 'hover:shadow-md'
                          }`}
                          style={{
                            top,
                            height,
                            zIndex,
                            left: hasOverlap ? `calc(${leftOffset}% + 4px)` : '4px',
                            right: hasOverlap ? 'auto' : '4px',
                            width: hasOverlap ? `${widthPercent}%` : 'auto',
                          }}
                          onClick={() => setActiveMeeting(m)}
                          onMouseEnter={() => setHoveredMeetingId(m.id)}
                          onMouseLeave={() => setHoveredMeetingId(null)}
                        >
                          <div dir="rtl" className={`flex flex-col text-right overflow-hidden ${gapClass}`}>
                            <div className={`flex flex-row-reverse items-start ${rowGapClass}`}>
                              <span className={`shrink-0 inline-flex rounded-full font-semibold ${pillPaddingClass} ${pillClass} ${statusPill[m.status]}`}>
                                {statusLabel[m.status]}
                              </span>
                              <span className={`flex-1 min-w-0 font-bold leading-tight text-[var(--color-text)] ${titleClass} ${titleClamp}`}>
                                {m.title}
                              </span>
                            </div>
                            {showMeta && useCompactMeta ? (
                              <div className={`flex items-center gap-1 ${metaClass} text-[var(--color-text-muted)]`}>
                                <span className="min-w-0 flex-1 truncate">{m.userName}</span>
                                <span dir="ltr" className="shrink-0">{timeRangeCompact}</span>
                              </div>
                            ) : showMeta ? (
                              <>
                                <div className={`${metaClass} text-[var(--color-text-muted)] truncate`}>{m.userName}</div>
                                <div dir="ltr" className={`${metaClass} text-[var(--color-text-muted)]`}>
                                  {timeRange}
                                </div>
                              </>
                            ) : null}
                            {!compact && m.notes && !hasOverlap ? (
                              <div className="mt-0.5 text-[9px] leading-tight text-[var(--color-text-muted)] line-clamp-1">
                                {m.notes}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="border-l border-[var(--color-border-light)]">
              {Array.from({ length: 12 }, (_, i) => {
                const hour = 8 + i
                return (
                  <div
                    key={hour}
                    className="relative px-3 text-right text-xs text-[var(--color-text-muted)]"
                    style={{ height: 60 * pxPerMin }}
                    dir="rtl"
                  >
                    <div className="sticky top-0 pt-2">{hour}:00</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Month View */}
      {view === 'month' && (
        <div className="hidden lg:block rounded-3xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border-light)]">
            {dayDefs.map((d) => (
              <div
                key={d.dayIndex}
                className={`px-3 py-3 text-center text-sm font-semibold text-[var(--color-text-muted)] ${d.dayIndex > 0 ? 'border-l border-[var(--color-border-light)]' : ''}`}
              >
                {d.label}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, idx) => {
              const dateKey = toDateKey(day)
              const isCurrentMonth = day.getMonth() === anchorDate.getMonth()
              const isToday = sameDay(day, new Date())
              const holiday = isHoliday(dateKey)
              const blocked = isDateBlocked(dateKey)
              const dayMeetings = visibleMeetings.filter((m) => sameDay(new Date(m.start), day))

              return (
                <div
                  key={idx}
                  className={`min-h-[120px] p-2 ${idx % 7 !== 0 ? 'border-l border-[var(--color-border-light)]' : ''} ${idx >= 7 ? 'border-t border-[var(--color-border-light)]' : ''} ${!isCurrentMonth ? 'bg-[var(--color-background)]' : ''} ${holiday || blocked ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-[var(--color-primary)] text-white' : isCurrentMonth ? 'text-[var(--color-text)]' : 'text-[var(--color-text-light)]'}`}>
                      {day.getDate()}
                    </span>
                    {(holiday || blocked) && (
                      <AlertTriangle size={14} className="text-[var(--color-danger)]" />
                    )}
                  </div>
                  {holiday && (
                    <div className="mt-1 text-[10px] text-[var(--color-danger)] truncate">{holiday.name}</div>
                  )}
                  {blocked && !holiday && (
                    <div className="mt-1 text-[10px] text-[var(--color-danger)] truncate">{blocked.reason}</div>
                  )}
                  <div className="mt-2 space-y-1">
                    {dayMeetings.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="cursor-pointer rounded-lg bg-[var(--color-primary)] px-2 py-1 text-[10px] font-medium text-white truncate hover:opacity-80"
                        onClick={() => setActiveMeeting(m)}
                        title={m.title}
                      >
                        {m.title}
                      </div>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="text-[10px] text-[var(--color-text-muted)]">+{dayMeetings.length - 3} עוד</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meeting detail */}
      <Dialog open={!!activeMeeting} onOpenChange={(o) => !o && setActiveMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פרטי פגישה</DialogTitle>
            <DialogDescription>תצוגה בסיסית (דמו).</DialogDescription>
          </DialogHeader>
          {activeMeeting ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[var(--color-background)] p-4">
                <div className="flex flex-row-reverse items-center justify-between">
                  <span className="font-bold text-[var(--color-text)]">{activeMeeting.title}</span>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[activeMeeting.status]}`}>
                    {activeMeeting.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{activeMeeting.userName}</p>
                <p dir="ltr" className="mt-2 text-sm text-[var(--color-text-muted)]">
                  {new Date(activeMeeting.start).toLocaleString('he-IL')} → {new Date(activeMeeting.end).toLocaleString('he-IL')}
                </p>
                {activeMeeting.notes ? (
                  <div className="mt-4 rounded-2xl border border-[var(--color-border-light)] bg-white p-4 text-right">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)]">הערות</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text)] whitespace-pre-wrap break-words">
                      {activeMeeting.notes}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => setActiveMeeting(null)} className="w-full sm:w-auto">סגור</Button>
                <Button
                  variant="danger"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="w-full sm:w-auto"
                >
                  מחיקה
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New meeting */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>פגישה חדשה</DialogTitle>
            <DialogDescription>יצירה מהירה (דמו).</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text)]">לקוח</label>
              <div className="mt-2">
                <DropdownSelect
                  value={form.userId}
                  onChange={(v) => setForm((p) => ({ ...p, userId: v }))}
                  options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
                  buttonClassName="w-full justify-between bg-[var(--color-background)]"
                  contentAlign="end"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text)]">כותרת</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">תאריך</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
              {(() => {
                const holiday = form.date ? isHoliday(form.date) : null
                const blocked = form.date ? isDateBlocked(form.date) : null
                if (holiday) return <p className="mt-1 text-xs text-[var(--color-danger)]">חג: {holiday.name}</p>
                if (blocked) return <p className="mt-1 text-xs text-[var(--color-danger)]">{blocked.reason}</p>
                return null
              })()}
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סטטוס</label>
              <div className="mt-2">
                <DropdownSelect
                  value={form.status}
                  onChange={(v) => setForm((p) => ({ ...p, status: v as MeetingStatus }))}
                  options={[
                    { value: 'ממתין', label: 'ממתין' },
                    { value: 'מאושר', label: 'מאושר' },
                    { value: 'בוטל', label: 'בוטל' },
                  ]}
                  buttonClassName="w-full justify-between bg-[var(--color-background)]"
                  contentAlign="end"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">משעה</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">עד שעה</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text)]">הערות</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="mt-2 min-h-[90px] w-full rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setNewOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button variant="accent" onClick={createMeeting} className="w-full sm:w-auto" disabled={meetingSaving}>
              {meetingSaving ? 'שומר...' : 'שמירה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Availability settings */}
      <Dialog open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>הגדרות זמינות</DialogTitle>
            <DialogDescription>בחרו באילו ימים ושעות ניתן לקבוע פגישות, והחריגו תאריכים ספציפיים.</DialogDescription>
          </DialogHeader>

          {availabilityLoading && (
            <div className="text-sm text-[var(--color-text-muted)] text-center">טוען זמינות...</div>
          )}

          <div className="space-y-4 sm:space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Agent Count Setting */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4">
              <div className="flex flex-row-reverse items-center justify-between gap-3">
                <div className="text-right">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">כמות סוכנים פעילים</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    מספר הפגישות שניתן לקבוע במקביל באותה שעה.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAgentCount((prev) => Math.max(1, prev - 1))}
                    disabled={agentCount <= 1}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-background)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-lg font-bold text-[var(--color-text)]">{agentCount}</span>
                  <button
                    type="button"
                    onClick={() => setAgentCount((prev) => prev + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-background)]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Israeli Holidays Toggle */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4">
              <div className="flex flex-row-reverse items-center justify-between gap-3">
                <div className="text-right">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">חסימת חגי ישראל</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    חסימה אוטומטית של ראש השנה, יום כיפור, סוכות, פסח, שבועות ועוד.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBlockHolidays((prev) => !prev)}
                  className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors ${
                    blockHolidays
                      ? 'bg-[var(--color-success)] text-white'
                      : 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]'
                  }`}
                >
                  {blockHolidays ? 'פעיל' : 'כבוי'}
                </button>
              </div>
            </div>

            {/* Weekly availability */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4">
              <h3 className="text-sm font-bold text-[var(--color-text)]">זמינות שבועית (ברירת מחדל)</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">כיבוי יום יחסום קביעת פגישות ביום הזה. ניתן להוסיף מספר טווחי שעות ליום.</p>

              <div className="mt-4 space-y-3">
                {dayDefs.map((d) => {
                  const row = availability[d.dayIndex]
                  return (
                    <div
                      key={d.dayIndex}
                      className="rounded-2xl bg-[var(--color-background)] p-3"
                    >
                      <div className="flex flex-row-reverse items-center justify-between gap-3">
                        <div className="flex flex-row-reverse items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setAvailability((prev) =>
                                prev.map((x, i) => (i === d.dayIndex ? { ...x, enabled: !x.enabled } : x))
                              )
                            }
                            className={`inline-flex h-8 sm:h-9 items-center justify-center rounded-full px-3 text-xs sm:text-sm font-semibold transition-colors ${
                              row?.enabled
                                ? 'bg-[var(--color-success)] text-white'
                                : 'bg-white text-[var(--color-text-muted)] border border-[var(--color-border)]'
                            }`}
                            aria-pressed={row?.enabled}
                          >
                            {row?.enabled ? 'זמין' : 'לא זמין'}
                          </button>
                          <p className="text-sm font-semibold text-[var(--color-text)]">{d.label}</p>
                        </div>
                        
                        {row?.enabled && (
                          <button
                            type="button"
                            onClick={() =>
                              setAvailability((prev) =>
                                prev.map((x, i) =>
                                  i === d.dayIndex
                                    ? { ...x, ranges: [...x.ranges, { start: '09:00', end: '17:00' }] }
                                    : x
                                )
                              )
                            }
                            className="inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-medium bg-white text-[var(--color-primary)] border border-[var(--color-border)] hover:bg-[var(--color-background)]"
                          >
                            <Plus size={14} className="ml-1" />
                            הוסף טווח
                          </button>
                        )}
                      </div>

                      {row?.enabled && row.ranges.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {row.ranges.map((range, rangeIdx) => (
                            <div key={rangeIdx} className="flex flex-row-reverse items-center gap-2 sm:gap-3">
                              <div className="flex flex-col flex-1 sm:flex-none">
                                <label className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">משעה</label>
                                <input
                                  type="time"
                                  value={range.start}
                                  onChange={(e) =>
                                    setAvailability((prev) =>
                                      prev.map((x, i) =>
                                        i === d.dayIndex
                                          ? {
                                              ...x,
                                              ranges: x.ranges.map((r, ri) =>
                                                ri === rangeIdx ? { ...r, start: e.target.value } : r
                                              ),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  className="mt-1 h-9 sm:h-10 w-full sm:w-[110px] rounded-full border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  dir="ltr"
                                />
                              </div>
                              <div className="flex flex-col flex-1 sm:flex-none">
                                <label className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">עד שעה</label>
                                <input
                                  type="time"
                                  value={range.end}
                                  onChange={(e) =>
                                    setAvailability((prev) =>
                                      prev.map((x, i) =>
                                        i === d.dayIndex
                                          ? {
                                              ...x,
                                              ranges: x.ranges.map((r, ri) =>
                                                ri === rangeIdx ? { ...r, end: e.target.value } : r
                                              ),
                                            }
                                          : x
                                      )
                                    )
                                  }
                                  className="mt-1 h-9 sm:h-10 w-full sm:w-[110px] rounded-full border border-[var(--color-border)] bg-white px-3 text-sm outline-none"
                                  dir="ltr"
                                />
                              </div>
                              {row.ranges.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAvailability((prev) =>
                                      prev.map((x, i) =>
                                        i === d.dayIndex
                                          ? { ...x, ranges: x.ranges.filter((_, ri) => ri !== rangeIdx) }
                                          : x
                                      )
                                    )
                                  }
                                  className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-50"
                                  aria-label="הסר טווח"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Exceptions */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4">
              <div className="flex flex-row-reverse items-center justify-between gap-3">
                <div className="text-right">
                  <h3 className="text-sm font-bold text-[var(--color-text)]">החרגות (Exceptions)</h3>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    חסימה או פתיחה של שעות ספציפיות בתאריכים מסוימים (תור לרופא, שינוי חד-פעמי).
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExceptionOpen(true)}
                >
                  <AnimatedIcon icon={Plus} size={16} variant="lift" />
                  הוסף
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {exceptions.length === 0 ? (
                  <div className="text-sm text-[var(--color-text-muted)] text-center py-4">אין החרגות.</div>
                ) : (
                  exceptions.map((exc) => (
                    <div
                      key={exc.id}
                      className={`flex flex-row-reverse items-center justify-between gap-3 rounded-2xl p-3 ${
                        exc.type === 'block' ? 'bg-red-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="flex flex-row-reverse items-center gap-3">
                        <div className={`inline-flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold ${
                          exc.type === 'block' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {exc.type === 'block' ? 'חסום' : 'פתוח'}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[var(--color-text)]">{formatShortDate(exc.date)}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {exc.allDay ? 'כל היום' : exc.ranges.map((r) => `${r.start}–${r.end}`).join(', ')} • {exc.reason}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExceptions((prev) => prev.filter((x) => x.id !== exc.id))}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white border border-[var(--color-border)] hover:bg-[var(--color-border-light)]"
                        aria-label="הסר"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setAvailabilityOpen(false)} className="w-full sm:w-auto">סגור</Button>
            <Button
              variant="accent"
              onClick={saveAvailability}
              disabled={availabilitySaving || availabilityLoading}
              className="w-full sm:w-auto"
            >
              {availabilitySaving ? 'שומר...' : 'שמירה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Exception Dialog */}
      <Dialog open={exceptionOpen} onOpenChange={setExceptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת החרגה</DialogTitle>
            <DialogDescription>חסימה או פתיחה של שעות ספציפיות בתאריך מסוים.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סוג החרגה</label>
              <div className="mt-2 flex flex-row-reverse gap-2">
                <button
                  type="button"
                  onClick={() => setExceptionForm((p) => ({ ...p, type: 'block' }))}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                    exceptionForm.type === 'block'
                      ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
                      : 'bg-[var(--color-background)] text-[var(--color-text-muted)]'
                  }`}
                >
                  חסימה
                </button>
                <button
                  type="button"
                  onClick={() => setExceptionForm((p) => ({ ...p, type: 'open' }))}
                  className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                    exceptionForm.type === 'open'
                      ? 'bg-green-100 text-green-700 ring-2 ring-green-500'
                      : 'bg-[var(--color-background)] text-[var(--color-text-muted)]'
                  }`}
                >
                  פתיחה
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">תאריך</label>
              <input
                type="date"
                value={exceptionForm.date}
                onChange={(e) => setExceptionForm((p) => ({ ...p, date: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>

            <div>
              <label className="flex flex-row-reverse items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={exceptionForm.allDay}
                  onChange={(e) => setExceptionForm((p) => ({ ...p, allDay: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                כל היום
              </label>
            </div>

            {!exceptionForm.allDay && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-[var(--color-text)]">טווחי שעות</label>
                {exceptionForm.ranges.map((range, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={range.start}
                      onChange={(e) => {
                        const updated = [...exceptionForm.ranges]
                        updated[idx] = { ...updated[idx], start: e.target.value }
                        setExceptionForm((p) => ({ ...p, ranges: updated }))
                      }}
                      className="h-10 flex-1 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
                    />
                    <span className="text-sm text-[var(--color-text-muted)]">עד</span>
                    <input
                      type="time"
                      value={range.end}
                      onChange={(e) => {
                        const updated = [...exceptionForm.ranges]
                        updated[idx] = { ...updated[idx], end: e.target.value }
                        setExceptionForm((p) => ({ ...p, ranges: updated }))
                      }}
                      className="h-10 flex-1 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
                    />
                    {exceptionForm.ranges.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setExceptionForm((p) => ({
                            ...p,
                            ranges: p.ranges.filter((_, i) => i !== idx),
                          }))
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-danger)] hover:bg-red-50"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setExceptionForm((p) => ({
                      ...p,
                      ranges: [...p.ranges, { start: '09:00', end: '17:00' }],
                    }))
                  }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  <Plus size={16} />
                  הוסף טווח
                </button>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סיבה / הערה</label>
              <input
                value={exceptionForm.reason}
                onChange={(e) => setExceptionForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="לדוגמה: תור לרופא, חופשה"
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setExceptionOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button variant="accent" onClick={addException} className="w-full sm:w-auto">הוסף</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete meeting confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="מחיקת פגישה"
        description="האם אתה בטוח שברצונך למחוק את הפגישה? פעולה זו אינה ניתנת לביטול."
        confirmText="מחיקה"
        onConfirm={async () => {
          if (!activeMeeting) return
          try {
            await deleteMeeting(activeMeeting.id)
            setMeetingItems((prev) => prev.filter((x) => x.id !== activeMeeting.id))
            toast.success('הפגישה נמחקה')
            setActiveMeeting(null)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת פגישה')
          }
        }}
      />
    </div>
  )
}
