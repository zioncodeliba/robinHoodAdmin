import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * Animate-UI inspired Dropdown Menu (Radix + motion)
 * Reference: https://animate-ui.com/docs/primitives/radix/dropdown-menu
 */

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuLabel = DropdownMenuPrimitive.Label
export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator

type ContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
  transition?: { duration?: number }
}

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  ContentProps
>(({ className, sideOffset = 8, transition, ...props }, ref) => {
  const duration = transition?.duration ?? 0.18

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[220px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-xl',
          className
        )}
        {...props}
      >
        <motion.div
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration, ease: 'easeOut' }}
        >
          {props.children}
        </motion.div>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = 'DropdownMenuContent'

type ItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
}

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  ItemProps
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm outline-none',
      'text-[var(--color-text)] hover:bg-[var(--color-border-light)] focus:bg-[var(--color-border-light)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pr-10',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('text-xs tracking-widest text-[var(--color-text-muted)]', className)}
      {...props}
    />
  )
}

/**
 * Highlight implementation (Animate-UI like feel)
 * Wrap items with DropdownMenuHighlightItem inside DropdownMenuHighlight.
 */
type HighlightContextValue = {
  setRect: (rect: { top: number; height: number } | null) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

const HighlightContext = React.createContext<HighlightContextValue | null>(null)

export function DropdownMenuHighlight({
  className,
  transition,
  children,
}: {
  className?: string
  transition?: { type?: 'spring'; stiffness?: number; damping?: number }
  children: React.ReactNode
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [rect, setRect] = React.useState<{ top: number; height: number } | null>(null)

  // Very fast, snappy highlight movement between items.
  // Tune: higher stiffness + lower mass => less lag; damping keeps it from overshooting.
  const spring =
    transition ?? ({ type: 'spring', stiffness: 1300, damping: 55, mass: 0.25 } as const)

  return (
    <HighlightContext.Provider value={{ setRect, containerRef }}>
      <div ref={containerRef} className={cn('relative', className)}>
        <AnimatePresence>
          {rect && (
            <motion.div
              key="highlight"
              className="absolute left-0 right-0 rounded-xl bg-[var(--color-border-light)]"
              style={{ top: rect.top, height: rect.height }}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                ...spring,
                opacity: { duration: 0.08 },
              }}
            />
          )}
        </AnimatePresence>
        <div className="relative">{children}</div>
      </div>
    </HighlightContext.Provider>
  )
}

export function DropdownMenuHighlightItem({
  children,
}: {
  children: React.ReactElement
}) {
  const ctx = React.useContext(HighlightContext)
  const ref = React.useRef<HTMLDivElement>(null)

  if (!ctx) return children

  const onEnter = () => {
    const el = ref.current
    const container = ctx.containerRef.current
    if (!el || !container) return
    const top = el.offsetTop
    const height = el.offsetHeight
    ctx.setRect({ top, height })
  }

  const onLeave = () => ctx.setRect(null)

  return (
    <div ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
    </div>
  )
}


