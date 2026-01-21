import { Menu } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { currentUser } from '@/lib/mock-data'
import { AnimatedIcon } from '@/components/ui/animated-icon'

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const today = new Date()

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-4 rounded-3xl border border-[var(--color-border)] bg-white px-3 sm:px-6 py-3 shadow-sm">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[var(--color-border-light)] shrink-0"
        aria-label="פתח תפריט"
      >
        <AnimatedIcon icon={Menu} size={22} variant="wiggle" />
      </button>

      {/* Spacer for desktop */}
      <div className="hidden lg:block flex-1" />

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-[var(--color-background)] rounded-full">
          <span className="text-sm text-[var(--color-text-muted)]">{formatDate(today)}</span>
        </div>

        {/* User display - no dropdown */}
        <div className="flex items-center gap-1 sm:gap-2 rounded-full px-2 sm:px-3 py-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-sm font-semibold">
            {currentUser.name.split(' ').map((n) => n[0]).join('')}
          </span>
          <span className="hidden sm:block text-sm font-medium text-[var(--color-text)]">
            {currentUser.name}
          </span>
        </div>
      </div>
    </header>
  )
}
