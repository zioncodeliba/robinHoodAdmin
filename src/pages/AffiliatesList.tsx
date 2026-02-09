import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Handshake, Wallet, DollarSign, ArrowUpDown, Banknote, ChevronLeft, ChevronRight } from 'lucide-react'

import { AnimatedIcon } from '@/components/ui/animated-icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownSelect } from '@/components/ui/dropdown-select'
import { Input } from '@/components/ui/input'
import { formatShortDate } from '@/lib/utils'
import { useAffiliates } from '@/lib/affiliates-store'
import type { AffiliateStatus } from '@/types'

type CombinedFilter = 'all' | 'פעיל' | 'לא פעיל' | 'requested' | 'not_requested'

function formatCurrencyILS(value: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)
}

const statusPill: Record<AffiliateStatus, string> = {
  'פעיל': 'bg-green-100 text-green-700',
  'לא פעיל': 'bg-zinc-100 text-zinc-700',
}

type SortKey = 'name' | 'code' | 'clicks' | 'conversions' | 'createdAt' | 'status'
type SortDir = 'asc' | 'desc'

export function AffiliatesList() {
  const navigate = useNavigate()
  const { affiliates, addAffiliate, totalBalanceDue, totalEarningsAllTime } = useAffiliates()

  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<CombinedFilter>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)

  const [form, setForm] = useState({
    // Personal
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    status: 'פעיל' as AffiliateStatus,
    // Bank
    beneficiaryName: '',
    bankName: '',
    branchNumber: '',
    accountNumber: '',
    iban: '',
    swift: '',
    // Notes
    internalNotes: '',
  })

  const filtered = useMemo(() => {
    let result = affiliates

    // Combined filter
    if (filter === 'פעיל') {
      result = result.filter((a) => a.status === 'פעיל')
    } else if (filter === 'לא פעיל') {
      result = result.filter((a) => a.status === 'לא פעיל')
    } else if (filter === 'requested') {
      result = result.filter((a) => a.withdrawalRequested)
    } else if (filter === 'not_requested') {
      result = result.filter((a) => !a.withdrawalRequested)
    }

    // Text search
    const q = query.trim().toLowerCase()
    if (q) {
      result = result.filter((a) => {
        return (
          a.name.toLowerCase().includes(q) ||
          a.code.toLowerCase().includes(q) ||
          (a.email ?? '').toLowerCase().includes(q) ||
          (a.phone ?? '').toLowerCase().includes(q)
        )
      })
    }

    return result
  }, [affiliates, query, filter])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    const arr = [...filtered]

    arr.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name, 'he-IL') * dir
        case 'code':
          return a.code.localeCompare(b.code, 'en') * dir
        case 'clicks':
          return (a.clicks - b.clicks) * dir
        case 'conversions':
          return (a.conversions - b.conversions) * dir
        case 'status':
          return a.status.localeCompare(b.status, 'he-IL') * dir
        case 'createdAt':
        default:
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
      }
    })

    return arr
  }, [filtered, sortKey, sortDir])

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, page, pageSize])

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1)
  }

  const toggleSort = (key: SortKey) => {
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
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      status: 'פעיל',
      beneficiaryName: '',
      bankName: '',
      branchNumber: '',
      accountNumber: '',
      iban: '',
      swift: '',
      internalNotes: '',
    })
    setModalOpen(true)
  }

  const submitCreate = async () => {
    const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('נא למלא שם פרטי ושם משפחה')
      return
    }

    // Auto-generate code
    const autoCode = `AFF-${Date.now().toString(36).toUpperCase()}`
    try {
      await addAffiliate({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        code: autoCode,
        status: form.status,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        internalNotes: form.internalNotes.trim() || undefined,
        bankDetails: form.bankName || form.branchNumber || form.accountNumber || form.beneficiaryName
          ? {
              beneficiaryName: form.beneficiaryName.trim() || name,
              bankName: form.bankName.trim() || '—',
              branchNumber: form.branchNumber.trim() || '—',
              accountNumber: form.accountNumber.trim() || '—',
              iban: form.iban.trim() || undefined,
              swift: form.swift.trim() || undefined,
            }
          : undefined,
      })

      toast.success('השותף נוסף בהצלחה')
      setModalOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה בהוספת שותף'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="text-right">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">שותפים עסקיים</h1>
          <p className="mt-1 text-sm sm:text-base text-[var(--color-text-muted)]">ניהול משווקים / שותפים במודל אפיליאציה</p>
        </div>

        <Button variant="accent" onClick={openCreate} className="w-full sm:w-auto">
          <AnimatedIcon icon={Plus} size={18} variant="lift" />
          הוספת שותף
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-row-reverse items-center justify-between">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">סה״כ רווחים (כל הזמנים)</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{formatCurrencyILS(totalEarningsAllTime)}</p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)]">
              <AnimatedIcon icon={DollarSign} size={20} variant="pulse" />
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--color-text-muted)]">
            תצוגת דמו. חישוב רווחים: 250₪ לכל המרה.
          </p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-row-reverse items-center justify-between">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">יתרה לתשלום</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{formatCurrencyILS(totalBalanceDue)}</p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)]">
              <AnimatedIcon icon={Wallet} size={20} variant="lift" />
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--color-text-muted)]">
            סכום פתוח לאחר קיזוז תשלומים ידניים.
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:max-w-md">
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-light)]">
                <AnimatedIcon icon={Handshake} size={18} variant="wiggle" />
              </span>
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  handleFilterChange()
                }}
                placeholder="חיפוש לפי שם / קוד / אימייל / טלפון..."
                className="pr-11"
              />
            </div>
            <div className="w-full sm:w-44">
              <DropdownSelect<CombinedFilter>
                value={filter}
                onChange={(v) => {
                  setFilter(v)
                  handleFilterChange()
                }}
                options={[
                  { value: 'all', label: 'כל השותפים' },
                  { value: 'פעיל', label: 'פעיל' },
                  { value: 'לא פעיל', label: 'לא פעיל' },
                  { value: 'requested', label: 'ביקש משיכה' },
                  { value: 'not_requested', label: 'לא ביקש משיכה' },
                ]}
                buttonClassName="w-full justify-between bg-white"
                contentAlign="end"
              />
            </div>
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            {sorted.length} שותפים
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {paginated.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/affiliates/${a.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[var(--color-text)] truncate">{a.name}</p>
                  {a.withdrawalRequested && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      <Banknote size={12} />
                      ביקש משיכה
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]" dir="ltr">{a.code}</p>
              </div>
              <span className={`shrink-0 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[a.status]}`}>
                {a.status}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-[var(--color-text-muted)]">קליקים: <span className="font-semibold text-[var(--color-text)]">{a.clicks}</span></span>
                <span className="text-[var(--color-text-muted)]">המרות: <span className="font-semibold text-[var(--color-text)]">{a.conversions}</span></span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{formatShortDate(a.createdAt)}</span>
            </div>
          </div>
        ))}
        {paginated.length === 0 && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center text-[var(--color-text-muted)]">
            לא נמצאו שותפים לפי החיפוש
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--color-border-light)] bg-white shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('name')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי שם"
                  >
                    שם
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'name' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('code')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי קוד"
                  >
                    קוד
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'code' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('clicks')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי קליקים"
                  >
                    קליקים
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'clicks' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('conversions')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי המרות"
                  >
                    המרות
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'conversions' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('createdAt')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי תאריך"
                  >
                    תאריך יצירה
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'createdAt' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
                <th className="px-6 py-3 text-right font-medium">
                  <button
                    onClick={() => toggleSort('status')}
                    className="inline-flex items-center gap-2 hover:text-[var(--color-text)]"
                    aria-label="מיון לפי סטטוס"
                  >
                    סטטוס
                    <AnimatedIcon icon={ArrowUpDown} size={16} variant="lift" className={sortKey === 'status' ? 'text-[var(--color-primary)]' : ''} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-[var(--color-border-light)] hover:bg-[var(--color-background)]"
                  onClick={() => navigate(`/affiliates/${a.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/affiliates/${a.id}`)
                  }}
                  tabIndex={0}
                >
                  <td className="px-6 py-4 text-right font-medium text-[var(--color-text)]">
                    <div className="flex items-center gap-2">
                      <span>{a.name}</span>
                      {a.withdrawalRequested && (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <Banknote size={12} />
                          ביקש משיכה
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                    <span dir="ltr" className="inline-block tabular-nums">
                      {a.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                    <span dir="ltr" className="inline-block tabular-nums">
                      {a.clicks}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--color-text-muted)]">
                    <span dir="ltr" className="inline-block tabular-nums">
                      {a.conversions}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--color-text-muted)] whitespace-nowrap">{formatShortDate(a.createdAt)}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusPill[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-muted)]">
                    לא נמצאו שותפים לפי החיפוש
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {sorted.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[var(--color-border)] bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span>שורות לדף:</span>
            <DropdownSelect<string>
              value={String(pageSize)}
              onChange={(v) => {
                setPageSize(Number(v))
                setPage(1)
              }}
              options={[
                { value: '5', label: '5' },
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '50', label: '50' },
              ]}
              buttonClassName="w-20 justify-between bg-white"
              contentAlign="end"
            />
          </div>
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <span className="text-sm text-[var(--color-text-muted)]">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} מתוך {sorted.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="הקודם"
              >
                <ChevronRight size={18} />
              </button>
              <span className="px-2 text-sm font-medium text-[var(--color-text)]">
                {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white hover:bg-[var(--color-border-light)] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="הבא"
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add affiliate modal (wide on desktop) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>הוספת שותף במודל אפיליאציה</DialogTitle>
            <DialogDescription>אפשר לפתוח את הטופס כפופאפ רחב בדסקטופ.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {/* Setup */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <h3 className="text-base font-bold text-[var(--color-text)]">הקמת שותף</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">פרטים בסיסיים לצורך זיהוי ושיוך.</p>

              <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">שם פרטי*</label>
                  <Input className="mt-2" value={form.firstName} onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">שם משפחה*</label>
                  <Input className="mt-2" value={form.lastName} onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">סטטוס</label>
                  <div className="mt-2">
                    <DropdownSelect<AffiliateStatus>
                      value={form.status}
                      onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                      options={[
                        { value: 'פעיל', label: 'פעיל' },
                        { value: 'לא פעיל', label: 'לא פעיל' },
                      ]}
                      buttonClassName="w-full justify-between bg-[var(--color-background)]"
                      contentAlign="end"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">טלפון</label>
                  <Input className="mt-2" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">דואר אלקטרוני</label>
                  <Input className="mt-2" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} dir="ltr" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">כתובת</label>
                  <Input className="mt-2" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <h3 className="text-base font-bold text-[var(--color-text)]">הערות פנימיות</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">לשימוש צוותי (דמו).</p>
              <textarea
                value={form.internalNotes}
                onChange={(e) => setForm((p) => ({ ...p, internalNotes: e.target.value }))}
                className="mt-4 min-h-[120px] sm:min-h-[150px] w-full rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm outline-none"
              />
            </div>

            {/* Bank details */}
            <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <h3 className="text-base font-bold text-[var(--color-text)]">פרטי חשבון בנק</h3>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">פרטים לתשלום (דמו).</p>

              <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">שם מוטב</label>
                  <Input className="mt-2" value={form.beneficiaryName} onChange={(e) => setForm((p) => ({ ...p, beneficiaryName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">בנק</label>
                  <Input className="mt-2" value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">סניף</label>
                  <Input className="mt-2" value={form.branchNumber} onChange={(e) => setForm((p) => ({ ...p, branchNumber: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">מספר חשבון</label>
                  <Input className="mt-2" value={form.accountNumber} onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">IBAN</label>
                  <Input className="mt-2" value={form.iban} onChange={(e) => setForm((p) => ({ ...p, iban: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">SWIFT</label>
                  <Input className="mt-2" value={form.swift} onChange={(e) => setForm((p) => ({ ...p, swift: e.target.value }))} dir="ltr" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button variant="accent" onClick={submitCreate} className="w-full sm:w-auto">הוסף שותף</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
