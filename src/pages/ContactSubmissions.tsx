import { useMemo, useState, type ReactNode } from 'react'
import { Mail, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { AnimatedIcon } from '@/components/ui/animated-icon'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatShortDate } from '@/lib/utils'
import { useContact } from '@/lib/contact-store'
import type { ContactSubmission, ContactSubmissionStatus } from '@/types'

const statusPill: Record<ContactSubmissionStatus, string> = {
  'חדש': 'bg-green-100 text-green-700',
  'בטיפול': 'bg-blue-100 text-blue-700',
  'טופל': 'bg-zinc-100 text-zinc-700',
}

const statusOptions: Array<{ value: ContactSubmissionStatus; label: string }> = [
  { value: 'חדש', label: 'חדש' },
  { value: 'בטיפול', label: 'בטיפול' },
  { value: 'טופל', label: 'טופל' },
]

type StatusFilter = 'הכל' | ContactSubmissionStatus

type SubmissionFormState = {
  fullName: string
  phone: string
  email: string
  message: string
  status: ContactSubmissionStatus
  source: string
}

const emptyForm: SubmissionFormState = {
  fullName: '',
  phone: '',
  email: '',
  message: '',
  status: 'חדש',
  source: 'צור קשר באתר',
}

function toFormState(submission: ContactSubmission): SubmissionFormState {
  return {
    fullName: submission.fullName,
    phone: submission.phone,
    email: submission.email,
    message: submission.message,
    status: submission.status,
    source: submission.source ?? 'צור קשר באתר',
  }
}

function DetailRow({ label, value, dir }: { label: string; value: ReactNode; dir?: 'rtl' | 'ltr' }) {
  return (
    <div className="flex flex-row-reverse items-start justify-between gap-4 sm:gap-6 rounded-2xl bg-[var(--color-background)] p-3 sm:p-4">
      <div className="text-right">
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      </div>
      <div className="min-w-0 text-right" dir={dir}>
        <div className="break-words text-sm font-semibold text-[var(--color-text)]">{value}</div>
      </div>
    </div>
  )
}

function getFormError(form: SubmissionFormState): string | null {
  if (!form.fullName.trim()) return 'יש להזין שם מלא'
  if (!form.phone.trim()) return 'יש להזין טלפון'
  if (!form.email.trim()) return 'יש להזין אימייל'
  if (!form.message.trim()) return 'יש להזין תוכן פנייה'
  return null
}

export function ContactSubmissions() {
  const {
    submissions,
    counts,
    loading,
    addSubmission,
    updateSubmission,
    deleteSubmission,
    setStatus,
  } = useContact()

  const [query, setQuery] = useState('')
  const [status, setStatusFilter] = useState<StatusFilter>('הכל')
  const [active, setActive] = useState<ContactSubmission | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<SubmissionFormState>(emptyForm)
  const [savingForm, setSavingForm] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return submissions.filter((s) => {
      const matchesQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.message.toLowerCase().includes(q)

      const matchesStatus = status === 'הכל' ? true : s.status === status
      return matchesQuery && matchesStatus
    })
  }, [submissions, query, status])

  const initials = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const second = parts[1]?.[0] ?? ''
    return `${first}${second}`.toUpperCase()
  }

  const openCreateForm = () => {
    setEditingId(null)
    setFormState(emptyForm)
    setFormOpen(true)
  }

  const openEditForm = (submission: ContactSubmission) => {
    setEditingId(submission.id)
    setFormState(toFormState(submission))
    setFormOpen(true)
  }

  const handleFormSubmit = async () => {
    const validationError = getFormError(formState)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSavingForm(true)
    try {
      if (editingId) {
        const updated = await updateSubmission(editingId, {
          fullName: formState.fullName,
          phone: formState.phone,
          email: formState.email,
          message: formState.message,
          status: formState.status,
          source: formState.source,
        })
        if (active?.id === editingId) {
          setActive(updated)
        }
        toast.success('הפנייה עודכנה')
      } else {
        await addSubmission({
          fullName: formState.fullName,
          phone: formState.phone,
          email: formState.email,
          message: formState.message,
          status: formState.status,
          source: formState.source,
        })
        toast.success('הפנייה נוספה')
      }
      setFormOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת הפנייה')
    } finally {
      setSavingForm(false)
    }
  }

  const handleDelete = async (submission: ContactSubmission) => {
    if (!window.confirm('למחוק את הפנייה?')) {
      return
    }

    setDeletingId(submission.id)
    try {
      await deleteSubmission(submission.id)
      if (active?.id === submission.id) {
        setActive(null)
      }
      toast.success('הפנייה נמחקה')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה במחיקת הפנייה')
    } finally {
      setDeletingId(null)
    }
  }

  const handleStatusSave = async () => {
    if (!active) {
      return
    }

    setSavingStatus(true)
    try {
      const updated = await setStatus(active.id, active.status)
      setActive(updated)
      toast.success('הסטטוס עודכן')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס')
    } finally {
      setSavingStatus(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-right">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">פניות</h1>
          <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">לידים שמגיעים מטופס "צור קשר" באתר</p>
        </div>
        <Button variant="accent" onClick={openCreateForm}>
          <Plus size={16} />
          פנייה חדשה
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {[
          { label: 'סה״כ פניות', value: counts.total },
          { label: 'חדשות', value: counts.new },
          { label: 'בטיפול', value: counts.inProgress },
          { label: 'טופלו', value: counts.done },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-6 shadow-sm">
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">{m.label}</p>
            <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]" dir="ltr">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-light)]">
              <AnimatedIcon icon={Mail} size={18} variant="pulse" />
            </span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם / טלפון / אימייל / תוכן..."
              className="pr-11"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
            <DropdownSelect<StatusFilter>
              value={status}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={[
                { value: 'הכל', label: 'כל הסטטוסים' },
                ...statusOptions,
              ]}
              buttonClassName="min-w-[160px] sm:min-w-[200px] justify-between bg-[var(--color-background)]"
              contentAlign="end"
            />
            <div className="text-sm text-[var(--color-text-muted)]">{filtered.length} תוצאות</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
          טוען פניות...
        </div>
      ) : null}

      {!loading ? (
        <div className="block md:hidden space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActive(s)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text)] truncate">{s.fullName}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]" dir="ltr">{s.phone}</p>
                  <p className="text-sm text-[var(--color-text-muted)] truncate" dir="ltr">{s.email}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[s.status]}`}>
                    {s.status}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">{formatShortDate(s.createdAt)}</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--color-text-muted)] line-clamp-2">{s.message}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
              לא נמצאו פניות לפי הפילטרים
            </div>
          )}
        </div>
      ) : null}

      {!loading ? (
        <div className="hidden md:block rounded-2xl border border-[var(--color-border-light)] bg-white shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" dir="rtl">
              <thead>
                <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                  <th className="px-6 py-3 text-right font-medium">שם מלא</th>
                  <th className="px-6 py-3 text-right font-medium">טלפון</th>
                  <th className="px-6 py-3 text-right font-medium">אימייל</th>
                  <th className="px-6 py-3 text-right font-medium">תוכן הפניה</th>
                  <th className="px-6 py-3 text-right font-medium">סטטוס</th>
                  <th className="px-6 py-3 text-right font-medium">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer border-t border-[var(--color-border-light)] hover:bg-[var(--color-background)]"
                    onClick={() => setActive(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setActive(s)
                    }}
                    tabIndex={0}
                  >
                    <td className="px-6 py-4 text-right font-medium text-[var(--color-text)]">{s.fullName}</td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                      <span dir="ltr" className="inline-block tabular-nums">{s.phone}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                      <span dir="ltr" className="inline-block">{s.email}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                      <span className="block max-w-[520px] truncate">{s.message}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[s.status]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--color-text-muted)] whitespace-nowrap">{formatShortDate(s.createdAt)}</td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-muted)]">
                      לא נמצאו פניות לפי הפילטרים
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>פרטי פנייה</DialogTitle>
            <DialogDescription>אפשר לשנות סטטוס, לערוך או למחוק.</DialogDescription>
          </DialogHeader>

          {active ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
                <div className="flex flex-row-reverse items-center gap-3">
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)] text-sm font-bold text-[var(--color-text)]">
                    {initials(active.fullName)}
                  </div>
                  <div className="text-right">
                    <p className="text-lg sm:text-xl font-bold leading-6 text-[var(--color-text)]">{active.fullName}</p>
                    <div className="mt-1 flex flex-row-reverse flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
                      <span>{active.source ?? 'צור קשר באתר'}</span>
                      <span className="text-[var(--color-text-light)]">•</span>
                      <span className="whitespace-nowrap">{formatShortDate(active.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <DropdownSelect<ContactSubmissionStatus>
                    value={active.status}
                    onChange={(v) => {
                      setActive((prev) => (prev ? { ...prev, status: v } : prev))
                    }}
                    options={statusOptions}
                    buttonClassName="min-w-[120px] sm:min-w-[160px] justify-between bg-[var(--color-background)]"
                    contentAlign="end"
                  />
                  <Button variant="accent" onClick={handleStatusSave} disabled={savingStatus}>
                    {savingStatus ? 'שומר...' : 'שמור'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="טלפון" value={<span dir="ltr">{active.phone}</span>} />
                <DetailRow label="אימייל" value={<span dir="ltr">{active.email}</span>} />
                <DetailRow label="סטטוס" value={<span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[active.status]}`}>{active.status}</span>} />
              </div>

              <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5 text-right">
                <p className="text-sm font-bold text-[var(--color-text)]">תוכן הפניה</p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-text-muted)]">
                  {active.message}
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => openEditForm(active)}>עריכה</Button>
                <Button variant="danger" onClick={() => handleDelete(active)} disabled={deletingId === active.id}>
                  {deletingId === active.id ? 'מוחק...' : 'מחיקה'}
                </Button>
                <Button variant="outline" onClick={() => setActive(null)}>סגור</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת פנייה' : 'פנייה חדשה'}</DialogTitle>
            <DialogDescription>ניהול פנייה ידני ממסך האדמין.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={formState.fullName}
              onChange={(e) => setFormState((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="שם מלא"
            />
            <Input
              value={formState.phone}
              onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="טלפון"
              dir="ltr"
            />
            <Input
              value={formState.email}
              onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="אימייל"
              dir="ltr"
            />
            <Input
              value={formState.source}
              onChange={(e) => setFormState((prev) => ({ ...prev, source: e.target.value }))}
              placeholder="מקור הפנייה"
            />
            <DropdownSelect<ContactSubmissionStatus>
              value={formState.status}
              onChange={(v) => setFormState((prev) => ({ ...prev, status: v }))}
              options={statusOptions}
              buttonClassName="w-full justify-between bg-[var(--color-background)]"
              contentAlign="end"
            />
            <textarea
              value={formState.message}
              onChange={(e) => setFormState((prev) => ({ ...prev, message: e.target.value }))}
              className="min-h-[140px] w-full rounded-2xl border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-light)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              placeholder="תוכן הפנייה"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={savingForm}>ביטול</Button>
            <Button variant="accent" onClick={handleFormSubmit} disabled={savingForm}>
              {savingForm ? 'שומר...' : 'שמור'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
