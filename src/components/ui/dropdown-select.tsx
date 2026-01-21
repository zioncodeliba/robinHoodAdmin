import { ChevronDown } from 'lucide-react'
import { AnimatedIcon } from '@/components/ui/animated-icon'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHighlight,
  DropdownMenuHighlightItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type DropdownSelectOption<T extends string> = {
  value: T
  label: string
}

export function DropdownSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  buttonClassName,
  contentAlign = 'start',
}: {
  value: T
  onChange: (value: T) => void
  options: DropdownSelectOption<T>[]
  placeholder?: string
  className?: string
  buttonClassName?: string
  contentAlign?: 'start' | 'end' | 'center'
}) {
  const current = options.find((o) => o.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-between gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm text-[var(--color-text)]',
            'hover:bg-white transition-colors',
            buttonClassName
          )}
        >
          <span className="min-w-0 truncate">
            {current?.label ?? placeholder ?? ''}
          </span>
          <AnimatedIcon icon={ChevronDown} size={16} variant="lift" className="text-[var(--color-text-muted)]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={contentAlign} className={cn('min-w-[220px]', className)}>
        <div dir="rtl">
          <DropdownMenuHighlight>
            {options.map((o) => (
              <DropdownMenuHighlightItem key={o.value}>
                <DropdownMenuItem
                  onSelect={() => onChange(o.value)}
                  className={cn(
                    'flex items-center justify-between flex-row-reverse',
                    o.value === value && 'font-semibold'
                  )}
                >
                  <span className="text-right">{o.label}</span>
                  {o.value === value ? (
                    <span className="text-xs text-[var(--color-text-muted)]">נבחר</span>
                  ) : null}
                </DropdownMenuItem>
              </DropdownMenuHighlightItem>
            ))}
          </DropdownMenuHighlight>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


