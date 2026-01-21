import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StatCard({
  title,
  value,
  growth,
  icon,
}: {
  title: string
  value: string | number
  growth: number
  icon: React.ReactNode
}) {
  const isPositive = growth >= 0

  return (
    <div className="group rounded-2xl border border-[var(--color-border-light)] bg-white p-3 sm:p-6 shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 order-2 sm:order-1">
          <p className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)]">{title}</p>
          <p className="mt-1 sm:mt-2 text-xl sm:text-3xl font-bold text-[var(--color-text)]">{value}</p>
          <div className="mt-1 sm:mt-2 flex items-center gap-1 flex-wrap">
            {isPositive ? (
              <TrendingUp size={14} className="text-[var(--color-success)] sm:w-4 sm:h-4" />
            ) : (
              <TrendingDown size={14} className="text-[var(--color-danger)] sm:w-4 sm:h-4" />
            )}
            <span
              className={cn(
                'text-xs sm:text-sm font-medium',
                isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
              )}
            >
              {isPositive ? '+' : ''}
              {growth}%
            </span>
            <span className="hidden sm:inline text-sm text-[var(--color-text-light)]">מהחודש שעבר</span>
          </div>
        </div>
        <div className="order-1 sm:order-2 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-[1.02] self-end sm:self-start">
          {icon}
        </div>
      </div>
    </div>
  )
}
