import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const MobileDrawer = DialogPrimitive.Root
export const MobileDrawerTrigger = DialogPrimitive.Trigger
export const MobileDrawerClose = DialogPrimitive.Close

export const MobileDrawerPortal = DialogPrimitive.Portal

export const MobileDrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
MobileDrawerOverlay.displayName = 'MobileDrawerOverlay'

export const MobileDrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <MobileDrawerPortal>
    <MobileDrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 h-full w-80 bg-white shadow-2xl outline-none',
        // RTL: drawer from right
        'right-0 top-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--color-border-light)]"
        aria-label="סגור"
      >
        <X size={18} className="text-[var(--color-text-muted)]" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </MobileDrawerPortal>
))
MobileDrawerContent.displayName = 'MobileDrawerContent'

