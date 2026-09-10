import type { ReactNode } from 'react'
import type { BadgeVariant } from '@/lib/types'

export interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  /** Render as a small dot + label for status indicators. */
  dot?: boolean
  className?: string
}

const VARIANTS: Record<BadgeVariant, { wrapper: string; dot: string }> = {
  success: {
    wrapper: 'bg-[var(--token-success)]/15 text-success border-[var(--token-success)]/30',
    dot: 'bg-[var(--token-success)]',
  },
  warning: {
    wrapper: 'bg-[var(--token-warning)]/15 text-warning border-[var(--token-warning)]/30',
    dot: 'bg-[var(--token-warning)]',
  },
  danger: {
    wrapper: 'bg-[var(--token-danger)]/15 text-danger border-[var(--token-danger)]/30',
    dot: 'bg-[var(--token-danger)]',
  },
  neutral: {
    wrapper: 'bg-surface-hover text-text-muted border-border',
    dot: 'bg-text-muted',
  },
  info: {
    wrapper: 'bg-[var(--token-primary)]/15 text-primary border-[var(--token-primary)]/30',
    dot: 'bg-[var(--token-primary)]',
  },
}

export function Badge({
  variant = 'neutral',
  children,
  dot = false,
  className = '',
}: BadgeProps) {
  const v = VARIANTS[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${v.wrapper} ${className}`}
    >
      {dot ? (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${v.dot}`}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  )
}

export default Badge
