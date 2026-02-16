import { useMemo, useState } from 'react'
import { Plus, Search, Filter, CalendarDays, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { formatShortDate } from '@/lib/utils'
import type { Gender } from '@/lib/auth-api'
import type { LeadStatus, MortgageType } from '@/types'
import { useNavigate } from 'react-router-dom'
import { useUsers } from '@/lib/users-store'

type StatusFilter = 'הכל' | LeadStatus

const statusStyles: Record<LeadStatus, string> = {
  'נרשם': 'bg-slate-100 text-slate-700',
  'שיחה עם הצ׳אט': 'bg-emerald-100 text-emerald-700',
  'חוסר התאמה': 'bg-rose-100 text-rose-700',
  'סיום צ׳אט בהצלחה': 'bg-lime-100 text-lime-700',
  'העלאת קבצים': 'bg-indigo-100 text-indigo-700',
  'ממתין לאישור עקרוני': 'bg-blue-100 text-blue-700',
  'אישור עקרוני': 'bg-cyan-100 text-cyan-700',
  'שיחת תמהיל': 'bg-amber-100 text-amber-700',
  'משא ומתן': 'bg-orange-100 text-orange-700',
  'חתימות': 'bg-purple-100 text-purple-700',
  'קבלת הכסף': 'bg-green-100 text-green-700',
  'מחזור - אין הצעה': 'bg-red-100 text-red-700',
  'מחזור - יש הצעה': 'bg-teal-100 text-teal-700',
  'מחזור - נקבעה פגישה': 'bg-cyan-100 text-cyan-700',
  'מחזור - ניטור': 'bg-gray-100 text-gray-700',
}

const mortgageTypeStyles: Record<MortgageType, string> = {
  '-': 'bg-slate-100 text-slate-600',
  'משכנתא חדשה': 'bg-purple-100 text-purple-700',
  'מחזור משכנתא': 'bg-cyan-100 text-cyan-700',
}

type LeadModalMode = 'create'
type SortKey = 'name' | 'lastActivityAt' | 'status'
type SortDir = 'asc' | 'desc'
type StatusFilterOption = 'הכל' | LeadStatus

export function LeadsList() {
  const navigate = useNavigate()
  const { users, addUser } = useUsers()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('הכל')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [sortKey, setSortKey] = useState<SortKey>('lastActivityAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<LeadModalMode>('create')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    status: 'נרשם' as LeadStatus,
    mortgageType: '-' as MortgageType,
    gender: 'male' as Gender,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((l) => {
      const matchesQuery =
        !q ||
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        l.phone.includes(q) ||
        l.email.toLowerCase().includes(q)

      const matchesStatus = status === 'הכל' ? true : l.status === status

      const created = new Date(l.createdAt).getTime()
      const fromOk = dateFrom ? created >= new Date(dateFrom).getTime() : true
      const toOk = dateTo ? created <= new Date(dateTo).getTime() : true

      return matchesQuery && matchesStatus && fromOk && toOk
    })
  }, [users, query, status, dateFrom, dateTo])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const arr = [...filtered]

    arr.sort((a, b) => {
      if (sortKey === 'name') {
        const an = `${a.firstName} ${a.lastName}`.trim()
        const bn = `${b.firstName} ${b.lastName}`.trim()
        return an.localeCompare(bn, 'he-IL') * dir
      }
      if (sortKey === 'status') {
        return a.status.localeCompare(b.status, 'he-IL') * dir
      }
      // lastActivityAt
      const at = new Date(a.lastActivityAt).getTime()
      const bt = new Date(b.lastActivityAt).getTime()
      return (at - bt) * dir
    })

    return arr
  }, [filtered, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (key: SortKey) => {
    setPage(1)
    if (sortKey === key) {
      // Same column - toggle direction
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      // Different column - set new key and reset to ascending
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const openCreate = () => {
    setErrors({})
    setForm({
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      status: 'נרשם',
      mortgageType: '-',
      gender: 'male',
    })
    setModalMode('create')
    setModalOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.firstName.trim()) next.firstName = 'שדה חובה'
    if (!form.lastName.trim()) next.lastName = 'שדה חובה'
    if (!form.phone.trim()) next.phone = 'שדה חובה'
    if (!form.email.trim()) next.email = 'שדה חובה'
    if (form.email && !form.email.includes('@')) next.email = 'אימייל לא תקין'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submitCreate = async () => {
    if (!validate()) return
    try {
      setIsSubmitting(true)
      const mortgageType = form.mortgageType === '-' ? '' : form.mortgageType
      await addUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        mail: form.email.trim(),
        phone: form.phone.trim(),
        status: form.status,
        mortgage_type: mortgageType,
        gender: form.gender,
      })
      setModalOpen(false)
    } catch {
      // Error toast is handled in the store.
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">לקוחות</h1>
          <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">ניהול רשימת לקוחות וסינונים</p>
        </div>

        <Button variant="accent" onClick={openCreate} className="w-full sm:w-auto">
          <AnimatedIcon icon={Plus} size={18} variant="lift" />
          הוספת לקוח חדש
        </Button>
      </div>

      {/* Filters bar */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative w-full">
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-light)]">
              <AnimatedIcon icon={Search} size={18} variant="pulse" />
            </span>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
              placeholder="חיפוש לפי שם / טלפון / אימייל..."
              className="pr-11"
            />
          </div>

          {/* Status + dates - scrollable on mobile */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-2">
              <AnimatedIcon icon={Filter} size={18} variant="wiggle" className="mr-2 text-[var(--color-text-muted)]" />
              <DropdownSelect<StatusFilterOption>
                value={status}
                onChange={(v) => {
                  setStatus(v as StatusFilter)
                  setPage(1)
                }}
                options={[
                  { value: 'הכל', label: 'כל הסטטוסים' },
                  { value: 'נרשם', label: 'נרשם' },
                  { value: 'שיחה עם הצ׳אט', label: 'שיחה עם הצ׳אט' },
                  { value: 'חוסר התאמה', label: 'חוסר התאמה' },
                  { value: 'סיום צ׳אט בהצלחה', label: 'סיום צ׳אט בהצלחה' },
                  { value: 'העלאת קבצים', label: 'העלאת קבצים' },
                  { value: 'ממתין לאישור עקרוני', label: 'ממתין לאישור עקרוני' },
                  { value: 'אישור עקרוני', label: 'אישור עקרוני' },
                  { value: 'שיחת תמהיל', label: 'שיחת תמהיל' },
                  { value: 'משא ומתן', label: 'משא ומתן' },
                  { value: 'חתימות', label: 'חתימות' },
                  { value: 'קבלת הכסף', label: 'קבלת הכסף' },
                  { value: 'מחזור - אין הצעה', label: 'מחזור - אין הצעה' },
                  { value: 'מחזור - יש הצעה', label: 'מחזור - יש הצעה' },
                  { value: 'מחזור - נקבעה פגישה', label: 'מחזור - נקבעה פגישה' },
                  { value: 'מחזור - ניטור', label: 'מחזור - ניטור' },
                ]}
                buttonClassName="border-0 bg-transparent px-2 py-1.5 hover:bg-transparent"
                className="min-w-[150px] sm:min-w-[220px]"
              />
            </div>

            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5">
              <AnimatedIcon icon={CalendarDays} size={18} variant="spin" className="text-[var(--color-text-muted)]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="bg-transparent text-sm text-[var(--color-text)] outline-none"
              />
              <span className="text-[var(--color-text-light)]">—</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="bg-transparent text-sm text-[var(--color-text)] outline-none"
              />
            </div>

            {/* Page size - hidden on mobile */}
            <div className="hidden lg:inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-2">
              <span className="mr-2 text-sm text-[var(--color-text-muted)]">רשומות לעמוד:</span>
              <DropdownSelect<'5' | '10' | '25' | '50'>
                value={String(pageSize) as '5' | '10' | '25' | '50'}
                onChange={(v) => {
                  setPageSize(Number(v))
                  setPage(1)
                }}
                options={[
                  { value: '5', label: '5' },
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                ]}
                buttonClassName="border-0 bg-transparent px-2 py-1.5 hover:bg-transparent min-w-[90px] justify-between"
                className="min-w-[160px]"
                contentAlign="end"
              />
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between text-sm text-[var(--color-text-muted)]">
          <span>{sorted.length} תוצאות</span>
          <button
            onClick={() => {
              setQuery('')
              setStatus('הכל')
              setDateFrom('')
              setDateTo('')
              setPage(1)
              setSortKey('lastActivityAt')
              setSortDir('desc')
            }}
            className="hover:text-[var(--color-text)]"
          >
            נקה פילטרים
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {paged.map((lead) => (
          <div
            key={lead.id}
            className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/users/${lead.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/users/${lead.id}`)
            }}
            tabIndex={0}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-text)] truncate">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]" dir="ltr">{lead.phone}</p>
                <p className="text-sm text-[var(--color-text-muted)] truncate" dir="ltr">{lead.email}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[lead.status]}`}>
                  {lead.status}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${mortgageTypeStyles[lead.mortgageType]}`}>
                  {lead.mortgageType}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{formatShortDate(lead.lastActivityAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {paged.length === 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
            לא נמצאו לקוחות לפי הפילטרים שנבחרו
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--color-border-light)] bg-white shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי שם"
                  >
                    שם
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">טלפון</th>
                <th className="px-6 py-3 text-right font-medium">אימייל</th>
                <th className="px-6 py-3 text-right font-medium">מסלול</th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי סטטוס"
                  >
                    סטטוס
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('lastActivityAt')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי פעילות אחרונה"
                  >
                    פעילות אחרונה
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-background)] cursor-pointer"
                  onClick={() => navigate(`/users/${lead.id}`)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/users/${lead.id}`)
                  }}
                >
                  <td className="px-6 py-4 font-medium text-[var(--color-text)]">
                    {lead.firstName} {lead.lastName}
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{lead.phone}</td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{lead.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${mortgageTypeStyles[lead.mortgageType]}`}>
                      {lead.mortgageType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[var(--color-text-muted)]">{formatShortDate(lead.lastActivityAt)}</td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-muted)]">
                    לא נמצאו לקוחות לפי הפילטרים שנבחרו
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-light)] px-6 py-4">
          <span className="text-sm text-[var(--color-text-muted)]">
            עמוד {page} מתוך {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-[var(--color-border-light)]"
            >
              <AnimatedIcon icon={ChevronRight} size={18} variant="lift" />
              הקודם
            </button>
            <button
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm disabled:opacity-50 hover:bg-[var(--color-border-light)]"
            >
              הבא
              <AnimatedIcon icon={ChevronLeft} size={18} variant="lift" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Pagination */}
      <div className="flex md:hidden items-center justify-between px-1">
        <span className="text-sm text-[var(--color-text-muted)]">
          {page}/{pageCount}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white disabled:opacity-50"
          >
            <AnimatedIcon icon={ChevronRight} size={18} variant="lift" />
          </button>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white disabled:opacity-50"
          >
            <AnimatedIcon icon={ChevronLeft} size={18} variant="lift" />
          </button>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          {modalMode === 'create' && (
            <>
              <DialogHeader>
                <DialogTitle>הוספת לקוח חדש</DialogTitle>
                <DialogDescription>מלאו את הפרטים הבסיסיים ושמרו.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">שם פרטי</label>
                  <Input value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} className="mt-2" />
                  {errors.firstName && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.firstName}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">שם משפחה</label>
                  <Input value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} className="mt-2" />
                  {errors.lastName && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.lastName}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">מגדר</label>
                  <div className="mt-2">
                    <DropdownSelect<Gender>
                      value={form.gender}
                      onChange={(v) => setForm((p) => ({ ...p, gender: v }))}
                      options={[
                        { value: 'male', label: 'גבר' },
                        { value: 'female', label: 'אישה' },
                      ]}
                      buttonClassName="w-full justify-between bg-white"
                      className="w-full"
                      contentAlign="end"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">טלפון</label>
                  <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2" />
                  {errors.phone && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.phone}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">אימייל</label>
                  <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className="mt-2" />
                  {errors.email && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.email}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">סטטוס</label>
                  <div className="mt-2">
                    <DropdownSelect<LeadStatus>
                      value={form.status}
                      onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                      options={[
                        { value: 'נרשם', label: 'נרשם' },
                        { value: 'שיחה עם הצ׳אט', label: 'שיחה עם הצ׳אט' },
                        { value: 'חוסר התאמה', label: 'חוסר התאמה' },
                        { value: 'סיום צ׳אט בהצלחה', label: 'סיום צ׳אט בהצלחה' },
                        { value: 'העלאת קבצים', label: 'העלאת קבצים' },
                        { value: 'ממתין לאישור עקרוני', label: 'ממתין לאישור עקרוני' },
                        { value: 'אישור עקרוני', label: 'אישור עקרוני' },
                        { value: 'שיחת תמהיל', label: 'שיחת תמהיל' },
                        { value: 'משא ומתן', label: 'משא ומתן' },
                        { value: 'חתימות', label: 'חתימות' },
                        { value: 'קבלת הכסף', label: 'קבלת הכסף' },
                        { value: 'מחזור - אין הצעה', label: 'מחזור - אין הצעה' },
                        { value: 'מחזור - יש הצעה', label: 'מחזור - יש הצעה' },
                        { value: 'מחזור - נקבעה פגישה', label: 'מחזור - נקבעה פגישה' },
                        { value: 'מחזור - ניטור', label: 'מחזור - ניטור' },
                      ]}
                      buttonClassName="w-full justify-between bg-white"
                      className="w-full"
                      contentAlign="end"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">מסלול</label>
                  <div className="mt-2">
                    <DropdownSelect<MortgageType>
                      value={form.mortgageType}
                      onChange={(v) => setForm((p) => ({ ...p, mortgageType: v }))}
                      options={[
                        { value: '-', label: '-' },
                        { value: 'משכנתא חדשה', label: 'משכנתא חדשה' },
                        { value: 'מחזור משכנתא', label: 'מחזור משכנתא' },
                      ]}
                      buttonClassName="w-full justify-between bg-white"
                      className="w-full"
                      contentAlign="end"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">ביטול</Button>
                <Button variant="accent" onClick={submitCreate} className="w-full sm:w-auto" disabled={isSubmitting}>
                  {isSubmitting ? 'שומר...' : 'שמור'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
