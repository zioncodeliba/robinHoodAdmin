import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatShortDate } from '@/lib/utils'
import { useUsers } from '@/lib/users-store'
import type { LeadStatus, MortgageType } from '@/types'

const statusStyles: Record<LeadStatus, string> = {
  'נרשם': 'bg-slate-100 text-slate-700',
  'שיחה עם הצ׳אט': 'bg-emerald-100 text-emerald-700',
  'חוסר התאמה': 'bg-rose-100 text-rose-700',
  'סיום צ׳אט בהצלחה': 'bg-lime-100 text-lime-700',
  'העלאת קבצים': 'bg-indigo-100 text-indigo-700',
  'ממתין לאישור עקרוני': 'bg-blue-100 text-blue-700',
  'אישור עקרוני': 'bg-sky-100 text-sky-700',
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

export function RecentLeadsTable() {
  const navigate = useNavigate()
  const { users } = useUsers()

  const recentLeads = useMemo(() => {
    const next = [...users]
    next.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return next
  }, [users])

  const visibleLeads = recentLeads.slice(0, 5)

  return (
    <div className="rounded-2xl border border-[var(--color-border-light)] bg-white shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-4 p-4 sm:p-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-[var(--color-text)]">לקוחות חדשים</h3>
          <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">{users.length} סה״כ לקוחות</p>
        </div>
        <button
          onClick={() => navigate('/users')}
          className="rounded-full border border-[var(--color-border)] bg-white px-3 sm:px-4 py-2 text-xs sm:text-sm text-[var(--color-text)] hover:bg-[var(--color-border-light)]"
        >
          הצג הכל
        </button>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden px-4 pb-4 space-y-3">
        {visibleLeads.map((lead) => (
          <div
            key={lead.id}
            className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-3 cursor-pointer"
            onClick={() => navigate(`/users/${lead.id}`)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-text)] text-sm truncate">
                  {lead.firstName} {lead.lastName}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5" dir="ltr">{lead.phone}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyles[lead.status]}`}>
                  {lead.status}
                </span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${mortgageTypeStyles[lead.mortgageType]}`}>
                  {lead.mortgageType}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{formatShortDate(lead.lastActivityAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {visibleLeads.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border-light)] bg-[var(--color-background)] p-4 text-center text-sm text-[var(--color-text-muted)]">
            לא נמצאו לקוחות
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-[var(--color-border-light)] text-[var(--color-text-muted)]">
              <th className="px-6 py-3 text-right font-medium">שם</th>
              <th className="px-6 py-3 text-right font-medium">טלפון</th>
              <th className="px-6 py-3 text-right font-medium">אימייל</th>
              <th className="px-6 py-3 text-right font-medium">מסלול</th>
              <th className="px-6 py-3 text-right font-medium">סטטוס</th>
              <th className="px-6 py-3 text-right font-medium">פעילות אחרונה</th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-[var(--color-border-light)] hover:bg-[var(--color-background)] cursor-pointer"
                onClick={() => navigate(`/users/${lead.id}`)}
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
            {recentLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-muted)]">
                  לא נמצאו לקוחות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
