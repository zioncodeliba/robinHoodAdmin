import { NavLink, Link } from 'react-router-dom'
import {
  Calendar,
  Handshake,
  LayoutDashboard,
  LogOut,
  Mail,
  Settings,
  Users,
} from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import { getCurrentAdminProfile } from '@/lib/admin-profile'
import { clearAuth } from '@/lib/auth-storage'
import { useContact } from '@/lib/contact-store'
import { cn } from '@/lib/utils'

interface NavItemConfig {
  to: string
  label: string
  icon: import('lucide-react').LucideIcon
  badge?: number
}

const navItems: NavItemConfig[] = [
  { to: '/dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
  { to: '/users', label: 'לקוחות', icon: Users },
  { to: '/meetings', label: 'פגישות', icon: Calendar },
  { to: '/affiliates', label: 'שותפים עסקיים', icon: Handshake },
  { to: '/contact', label: 'פניות', icon: Mail },
]

interface SideNavItemProps extends NavItemConfig {
  onNavClick?: () => void
}

function SideNavItem({ to, label, icon: Icon, badge, onNavClick }: SideNavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onNavClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-[#EEF2FF] text-[var(--color-text)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]'
        )
      }
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 text-[var(--color-text)] ring-1 ring-[var(--color-border-light)]">
          <AnimatedIcon icon={Icon} size={18} variant="wiggle" />
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      {typeof badge === 'number' && badge > 0 ? (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-xs font-semibold text-white">
          {badge}
        </span>
      ) : null}
    </NavLink>
  )
}

interface SidebarProps {
  onNavClick?: () => void
  className?: string
}

export function Sidebar({ onNavClick, className }: SidebarProps) {
  const currentAdmin = getCurrentAdminProfile()
  const { counts } = useContact()
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col overflow-hidden bg-white',
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)]">
          <img src="/logo.svg" alt="Robin" className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">Robin</p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">פאנל ניהול</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <p className="px-3 pb-3 text-[10px] font-semibold tracking-widest text-[var(--color-text-light)]">
          תפריט ראשי
        </p>
        <div className="space-y-1">
          {navItems.map((item) => (
            <SideNavItem
              key={item.to}
              {...item}
              badge={item.to === '/contact' ? counts.new : item.badge}
              onNavClick={onNavClick}
            />
          ))}
        </div>
      </nav>

      <div className="space-y-2 border-t border-[var(--color-border)] p-4">
        <div className="flex items-center justify-between rounded-2xl px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-xs font-semibold">
              {currentAdmin.name.split(' ').map((n) => n[0]).join('')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">{currentAdmin.name}</p>
              <p className="truncate text-xs text-[var(--color-text-muted)]">{currentAdmin.email}</p>
            </div>
          </div>
        </div>

        <Link
          to="/settings"
          onClick={onNavClick}
          className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]"
        >
          <div className="flex items-center gap-3">
            <AnimatedIcon icon={Settings} size={18} variant="spin" />
            <span>הגדרות</span>
          </div>
        </Link>

        <button
          onClick={() => {
            clearAuth()
            window.location.reload()
          }}
          className="flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-border-light)] hover:text-[var(--color-text)]"
        >
          <div className="flex items-center gap-3">
            <AnimatedIcon icon={LogOut} size={18} variant="lift" />
            <span>התנתקות</span>
          </div>
        </button>
      </div>

      {/* Copyright & Credits */}
      <div className="border-t border-[var(--color-border)] px-4 py-3 text-center">
        <p className="text-[10px] text-[var(--color-text-light)]">
          © {new Date().getFullYear()} Robin. All rights reserved.
        </p>
        <p className="mt-1 text-[10px] text-[var(--color-text-light)]">
          Design & Development by{' '}
          <a
            href="https://codeandcore.co.il"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Code and Core
          </a>
        </p>
      </div>
    </aside>
  )
}
