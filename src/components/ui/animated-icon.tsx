import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'

export type AnimatedIconVariant = 'lift' | 'wiggle' | 'spin' | 'pulse'

export type AnimatedIconProps = Omit<
  React.ComponentPropsWithoutRef<typeof motion.span>,
  'children'
> & {
  icon: LucideIcon
  size?: number
  variant?: AnimatedIconVariant
}

type MotionSpanProps = React.ComponentPropsWithoutRef<typeof motion.span>
type WhileHover = NonNullable<MotionSpanProps['whileHover']>
type WhileTap = NonNullable<MotionSpanProps['whileTap']>

const variantMotion: Record<AnimatedIconVariant, { whileHover: WhileHover; whileTap: WhileTap }> = {
  lift: { whileHover: { y: -1, scale: 1.06 }, whileTap: { scale: 0.94 } },
  wiggle: { whileHover: { rotate: -6, scale: 1.06 }, whileTap: { rotate: 6, scale: 0.94 } },
  spin: { whileHover: { rotate: 12, scale: 1.06 }, whileTap: { rotate: -12, scale: 0.94 } },
  pulse: { whileHover: { scale: 1.1 }, whileTap: { scale: 0.95 } },
}

export function AnimatedIcon({
  icon: Icon,
  size = 18,
  variant = 'lift',
  className,
  ...rest
}: AnimatedIconProps) {
  const motionProps = variantMotion[variant]

  return (
    <motion.span
      className={cn('inline-flex items-center justify-center', className)}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      {...motionProps}
      {...rest}
    >
      <Icon size={size} />
    </motion.span>
  )
}


