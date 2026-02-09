import { Link, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRight, Plus, Trash2, BarChart3, Building2, UserRound, Pencil, Banknote } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { formatShortDate } from '@/lib/utils'
import { useAffiliateById, useAffiliates } from '@/lib/affiliates-store'
import { fetchAffiliateCustomers, type CustomerItem } from '@/lib/customers-api'

function formatCurrencyILS(value: number) {
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value)
}

function calcEarnings(conversions: number) {
  return conversions * 250
}

function calcPaid(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, p) => sum + p.amount, 0)
}

function InfoTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-[var(--color-background)] p-3 sm:p-4 text-right">
      <p className="text-[10px] sm:text-xs text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-0.5 sm:mt-1 text-sm sm:text-base font-semibold text-[var(--color-text)] truncate">{value}</div>
    </div>
  )
}

export function AffiliateDetail() {
  const { id } = useParams()
  const affiliate = useAffiliateById(id)
  const { addPayment, updateAffiliate } = useAffiliates()

  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; paymentId: string | null }>({
    open: false,
    paymentId: null,
  })
  const [payForm, setPayForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    reference: '',
  })

  const [affiliateCustomers, setAffiliateCustomers] = useState<CustomerItem[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customersError, setCustomersError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: '',
    beneficiaryName: '',
    bankName: '',
    branchNumber: '',
    accountNumber: '',
    iban: '',
    swift: '',
  })

  const totals = useMemo(() => {
    if (!affiliate) return null
    const earnings = calcEarnings(affiliate.conversions)
    const paid = calcPaid(affiliate.payments)
    const due = Math.max(0, earnings - paid)
    return { earnings, paid, due }
  }, [affiliate])

  useEffect(() => {
    if (!affiliate?.id) return
    let isMounted = true
    setCustomersLoading(true)
    setCustomersError(null)
    fetchAffiliateCustomers(affiliate.id)
      .then((rows) => {
        if (!isMounted) return
        setAffiliateCustomers(rows)
      })
      .catch((error) => {
        if (!isMounted) return
        const message = error instanceof Error ? error.message : 'שגיאה בטעינת לקוחות'
        setCustomersError(message)
        setAffiliateCustomers([])
      })
      .finally(() => {
        if (!isMounted) return
        setCustomersLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [affiliate?.id])

  if (!affiliate) {
    return (
      <div className="space-y-4" dir="rtl">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">פרטי שותף</h1>
        <div className="rounded-3xl border border-[var(--color-border)] bg-white p-6 text-right">
          <p className="text-[var(--color-text-muted)]">השותף לא נמצא.</p>
          <div className="mt-4">
            <Link to="/affiliates" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
              <AnimatedIcon icon={ArrowRight} size={16} variant="lift" />
              חזרה לרשימת השותפים
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const openEdit = () => {
    setEditForm({
      name: affiliate.name ?? '',
      code: affiliate.code ?? '',
      email: affiliate.email ?? '',
      phone: affiliate.phone ?? '',
      address: affiliate.address ?? '',
      beneficiaryName: affiliate.bankDetails?.beneficiaryName ?? '',
      bankName: affiliate.bankDetails?.bankName ?? '',
      branchNumber: affiliate.bankDetails?.branchNumber ?? '',
      accountNumber: affiliate.bankDetails?.accountNumber ?? '',
      iban: affiliate.bankDetails?.iban ?? '',
      swift: affiliate.bankDetails?.swift ?? '',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    const name = editForm.name.trim()
    const code = editForm.code.trim().toUpperCase()
    if (!name) return toast.error('נא למלא שם שותף')
    if (!code) return toast.error('נא למלא קוד שותף')

    const hasAnyBank =
      !!editForm.beneficiaryName.trim() ||
      !!editForm.bankName.trim() ||
      !!editForm.branchNumber.trim() ||
      !!editForm.accountNumber.trim() ||
      !!editForm.iban.trim() ||
      !!editForm.swift.trim()

    try {
      await updateAffiliate(affiliate.id, {
        name,
        code,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        bankDetails: hasAnyBank
          ? {
              beneficiaryName: editForm.beneficiaryName.trim() || name,
              bankName: editForm.bankName.trim() || '—',
              branchNumber: editForm.branchNumber.trim() || '—',
              accountNumber: editForm.accountNumber.trim() || '—',
              iban: editForm.iban.trim() || undefined,
              swift: editForm.swift.trim() || undefined,
            }
          : undefined,
      })
      toast.success('פרטי השותף עודכנו')
      setEditOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה בעדכון השותף'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1 text-right">
          <div className="flex items-center justify-end">
            <Link to="/affiliates" className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <AnimatedIcon icon={ArrowRight} size={16} variant="lift" />
              חזרה לרשימת השותפים
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text)]">פרטי שותף</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm sm:text-base text-[var(--color-text-muted)]">{affiliate.name}</p>
            {affiliate.withdrawalRequested && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Banknote size={14} />
                ביקש משיכה
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={openEdit} className="flex-1 sm:flex-none">
            <AnimatedIcon icon={Pencil} size={18} variant="wiggle" />
            <span className="hidden sm:inline">עריכת פרטים</span>
            <span className="sm:hidden">עריכה</span>
          </Button>
          <button
            onClick={async () => {
              try {
                await updateAffiliate(affiliate.id, { status: affiliate.status === 'פעיל' ? 'לא פעיל' : 'פעיל' })
                toast.success('הסטטוס עודכן')
              } catch (error) {
                const message = error instanceof Error ? error.message : 'שגיאה בעדכון סטטוס'
                toast.error(message)
              }
            }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
              affiliate.status === 'פעיל'
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {affiliate.status}
          </button>
          <Button
            variant={affiliate.withdrawalRequested ? 'danger' : 'outline'}
            className="flex-1 sm:flex-none"
            onClick={async () => {
              try {
                await updateAffiliate(affiliate.id, { withdrawalRequested: !affiliate.withdrawalRequested })
                toast.success(affiliate.withdrawalRequested ? 'בקשת המשיכה בוטלה' : 'סומן כביקש משיכה')
              } catch (error) {
                const message = error instanceof Error ? error.message : 'שגיאה בעדכון בקשת משיכה'
                toast.error(message)
              }
            }}
          >
            <Banknote size={18} />
            <span className="hidden sm:inline">{affiliate.withdrawalRequested ? 'בטל בקשת משיכה' : 'סמן ביקש משיכה'}</span>
            <span className="sm:hidden">{affiliate.withdrawalRequested ? 'בטל' : 'משיכה'}</span>
          </Button>
          <Button variant="accent" onClick={() => setPayOpen(true)} className="w-full sm:w-auto mt-1 sm:mt-0">
            <AnimatedIcon icon={Plus} size={18} variant="lift" />
            הוספת תשלום
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:gap-6 sm:grid-cols-3">
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-row-reverse items-center justify-between">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">רווחים (כל הזמנים)</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{formatCurrencyILS(totals?.earnings ?? 0)}</p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)]">
              <AnimatedIcon icon={BarChart3} size={20} variant="pulse" />
            </div>
          </div>
          <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--color-text-muted)]">דמו: 250₪ לכל המרה.</p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-row-reverse items-center justify-between">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">שולם בפועל</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{formatCurrencyILS(totals?.paid ?? 0)}</p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)]">
              <AnimatedIcon icon={Building2} size={20} variant="lift" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-row-reverse items-center justify-between">
            <div className="text-right">
              <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">יתרה לתשלום</p>
              <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{formatCurrencyILS(totals?.due ?? 0)}</p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-background)] ring-1 ring-[var(--color-border-light)]">
              <AnimatedIcon icon={UserRound} size={20} variant="wiggle" />
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">פרטים אישיים</h2>
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 sm:gap-4">
            <InfoTile label="שם" value={affiliate.name} />
            <InfoTile label="קוד" value={<span dir="ltr">{affiliate.code}</span>} />
            <InfoTile label="טלפון" value={affiliate.phone ? <span dir="ltr">{affiliate.phone}</span> : '—'} />
            <InfoTile label="אימייל" value={affiliate.email ? <span dir="ltr">{affiliate.email}</span> : '—'} />
            <div className="col-span-2">
              <InfoTile label="כתובת" value={affiliate.address ?? '—'} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">פרטי חשבון בנק לתשלום</h2>
          <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-2 sm:gap-4">
            <InfoTile label="שם מוטב" value={affiliate.bankDetails?.beneficiaryName ?? '—'} />
            <InfoTile label="בנק" value={affiliate.bankDetails?.bankName ?? '—'} />
            <InfoTile label="סניף" value={affiliate.bankDetails?.branchNumber ? <span dir="ltr">{affiliate.bankDetails.branchNumber}</span> : '—'} />
            <InfoTile label="מספר חשבון" value={affiliate.bankDetails?.accountNumber ? <span dir="ltr">{affiliate.bankDetails.accountNumber}</span> : '—'} />
            <InfoTile label="IBAN" value={affiliate.bankDetails?.iban ? <span dir="ltr">{affiliate.bankDetails.iban}</span> : '—'} />
            <InfoTile label="SWIFT" value={affiliate.bankDetails?.swift ? <span dir="ltr">{affiliate.bankDetails.swift}</span> : '—'} />
          </div>
        </div>
      </div>

      {/* Traffic chart */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex items-end justify-between gap-3" dir="rtl">
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">תנועת טראפיק לפי חודש</h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">קליקים והמרות (דמו)</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-5 w-full min-w-0">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={affiliate.trafficByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} width={30} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid var(--color-border)',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
                  direction: 'rtl',
                }}
                formatter={(value, name) => {
                  const v = typeof value === 'number' ? value : Number(value ?? 0)
                  const label = name === 'clicks' ? 'קליקים' : 'המרות'
                  return [`${v}`, label]
                }}
              />
              <Line type="monotone" dataKey="clicks" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 2, fill: '#0EA5E9' }} />
              <Line type="monotone" dataKey="conversions" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 2, fill: 'var(--color-accent)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payments */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" dir="rtl">
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">תשלומים</h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">ניהול ידני של תשלומים שבוצעו בפועל.</p>
          </div>
          <Button variant="accent" onClick={() => setPayOpen(true)} className="w-full sm:w-auto">
            <AnimatedIcon icon={Plus} size={18} variant="lift" />
            הוספת שורה
          </Button>
        </div>

        {/* Mobile Card View for Payments */}
        <div className="mt-4 space-y-3 sm:hidden">
          {affiliate.payments.length === 0 ? (
            <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
              עדיין לא הוזנו תשלומים.
            </div>
          ) : (
            affiliate.payments.map((p) => (
              <div key={p.id} className="flex flex-row-reverse items-center justify-between gap-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{formatCurrencyILS(p.amount)}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{formatShortDate(p.date)}</p>
                  {p.reference && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)] truncate">אסמכתא: {p.reference}</p>
                  )}
                </div>
                <button
                  onClick={() => setDeleteConfirm({ open: true, paymentId: p.id })}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-danger)]"
                  aria-label="מחיקה"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table for Payments */}
        <div className="mt-5 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm" dir="rtl">
            <thead>
              <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                <th className="px-4 py-3 text-right font-medium">תאריך</th>
                <th className="px-4 py-3 text-right font-medium">סכום ששולם</th>
                <th className="px-4 py-3 text-right font-medium">אסמכתא / הערה</th>
                <th className="px-4 py-3 text-right font-medium w-[80px]">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {affiliate.payments.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border-light)]">
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatShortDate(p.date)}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text)]">{formatCurrencyILS(p.amount)}</td>
                  <td className="px-4 py-3 text-[var(--color-text-muted)]">{p.reference || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setDeleteConfirm({ open: true, paymentId: p.id })}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[var(--color-danger)] hover:bg-red-50"
                        aria-label="מחיקה"
                        title="מחיקה"
                      >
                        <AnimatedIcon icon={Trash2} size={16} variant="pulse" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {affiliate.payments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    עדיין לא הוזנו תשלומים.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Affiliate customers */}
      <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between" dir="rtl">
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)]">לקוחות משויכים לשותף</h2>
            <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
              לקוחות שנרשמו או התחברו עם קוד השותף.
            </p>
          </div>
          <span className="text-xs sm:text-sm text-[var(--color-text-muted)]">
            סה״כ: {affiliateCustomers.length}
          </span>
        </div>

        {customersLoading ? (
          <div className="mt-4 rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
            טוען לקוחות...
          </div>
        ) : customersError ? (
          <div className="mt-4 rounded-xl bg-red-50 p-4 text-center text-xs text-red-600">
            {customersError}
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="mt-4 space-y-3 sm:hidden">
              {affiliateCustomers.length === 0 ? (
                <div className="rounded-xl bg-[var(--color-background)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                  לא נמצאו לקוחות משויכים.
                </div>
              ) : (
                affiliateCustomers.map((c) => (
                  <div key={c.id} className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">
                          {`${c.first_name} ${c.last_name}`.trim() || '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]" dir="ltr">
                          {c.phone || '—'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]" dir="ltr">
                          {c.mail || '—'}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--color-background)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                        {c.status || '—'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                      <span>סוג: {c.mortgage_type || '—'}</span>
                      <span>{formatShortDate(c.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <div className="mt-5 hidden overflow-x-auto sm:block">
              <table className="w-full text-sm" dir="rtl">
                <thead>
                  <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
                    <th className="px-4 py-3 text-right font-medium">שם</th>
                    <th className="px-4 py-3 text-right font-medium">טלפון</th>
                    <th className="px-4 py-3 text-right font-medium">אימייל</th>
                    <th className="px-4 py-3 text-right font-medium">סטטוס</th>
                    <th className="px-4 py-3 text-right font-medium">סוג משכנתא</th>
                    <th className="px-4 py-3 text-right font-medium">תאריך</th>
                  </tr>
                </thead>
                <tbody>
                  {affiliateCustomers.map((c) => (
                    <tr key={c.id} className="border-t border-[var(--color-border-light)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-text)]">
                        {`${c.first_name} ${c.last_name}`.trim() || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]" dir="ltr">
                        {c.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]" dir="ltr">
                        {c.mail || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.status || '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">{c.mortgage_type || '—'}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {formatShortDate(c.created_at)}
                      </td>
                    </tr>
                  ))}
                  {affiliateCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                        לא נמצאו לקוחות משויכים.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add payment modal */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>הוספת תשלום</DialogTitle>
            <DialogDescription>הוסיפו תאריך וסכום ששולם בפועל.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">תאריך</label>
              <input
                type="date"
                value={payForm.date}
                onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
                className="mt-2 h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">סכום</label>
              <Input
                className="mt-2"
                value={String(payForm.amount)}
                onChange={(e) => setPayForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                dir="ltr"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text)]">אסמכתא / הערה</label>
              <Input
                className="mt-2"
                value={payForm.reference}
                onChange={(e) => setPayForm((p) => ({ ...p, reference: e.target.value }))}
                placeholder="מספר העברה, שם חשבונית, הערה חופשית..."
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button
              variant="accent"
              className="w-full sm:w-auto"
              onClick={() => {
                if (!payForm.date) return toast.error('בחרו תאריך')
                if (!payForm.amount || payForm.amount <= 0) return toast.error('הזינו סכום תקין')
                addPayment(affiliate.id, { 
                  date: payForm.date, 
                  amount: payForm.amount,
                  reference: payForm.reference.trim() || undefined,
                })
                toast.success('התשלום נוסף')
                setPayOpen(false)
                setPayForm({ date: new Date().toISOString().slice(0, 10), amount: 0, reference: '' })
              }}
            >
              שמירה
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit affiliate modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>עריכת פרטי שותף</DialogTitle>
            <DialogDescription>עדכנו פרטים אישיים ופרטי חשבון לתשלום.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {/* Personal */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">פרטים אישיים</h3>
              <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">שם שותף*</label>
                  <Input className="mt-2" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">קוד*</label>
                  <Input className="mt-2" value={editForm.code} onChange={(e) => setEditForm((p) => ({ ...p, code: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">טלפון</label>
                  <Input className="mt-2" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} dir="ltr" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">אימייל</label>
                  <Input className="mt-2" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} dir="ltr" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">כתובת</label>
                  <Input className="mt-2" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Bank */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--color-border)] bg-white p-4 sm:p-5">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)]">פרטי חשבון לתשלום</h3>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">אם תשאירו את כל השדות ריקים — הפרטים יוסרו.</p>
              <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">שם מוטב</label>
                  <Input className="mt-2" value={editForm.beneficiaryName} onChange={(e) => setEditForm((p) => ({ ...p, beneficiaryName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">בנק</label>
                  <Input className="mt-2" value={editForm.bankName} onChange={(e) => setEditForm((p) => ({ ...p, bankName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">סניף</label>
                  <Input className="mt-2" value={editForm.branchNumber} onChange={(e) => setEditForm((p) => ({ ...p, branchNumber: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">מספר חשבון</label>
                  <Input className="mt-2" value={editForm.accountNumber} onChange={(e) => setEditForm((p) => ({ ...p, accountNumber: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">IBAN</label>
                  <Input className="mt-2" value={editForm.iban} onChange={(e) => setEditForm((p) => ({ ...p, iban: e.target.value }))} dir="ltr" />
                </div>
                <div>
                  <label className="text-xs sm:text-sm font-medium text-[var(--color-text)]">SWIFT</label>
                  <Input className="mt-2" value={editForm.swift} onChange={(e) => setEditForm((p) => ({ ...p, swift: e.target.value }))} dir="ltr" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="w-full sm:w-auto">ביטול</Button>
            <Button variant="accent" onClick={saveEdit} className="w-full sm:w-auto">שמירה</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete payment confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ open, paymentId: null })}
        title="מחיקת תשלום"
        description="האם אתה בטוח שברצונך למחוק את התשלום? פעולה זו אינה ניתנת לביטול."
        confirmText="מחיקה"
        onConfirm={() => {
          if (deleteConfirm.paymentId) {
            updateAffiliate(affiliate.id, { payments: affiliate.payments.filter((x) => x.id !== deleteConfirm.paymentId) })
            toast.success('התשלום נמחק')
          }
        }}
      />
    </div>
  )
}
