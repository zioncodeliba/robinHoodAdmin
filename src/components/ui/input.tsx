import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-11 w-full rounded-full border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-light)]',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'


