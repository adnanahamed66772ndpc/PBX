import type { ReactNode } from 'react'

export interface CardProps {
  title: string
  value: ReactNode
  icon?: ReactNode
  delta?: ReactNode
  className?: string
  /** Optional accessible description of the metric. */
  description?: string
}

export function Card({
  title,
  value,
  icon,
  delta,
  description,
  className = '',
}: CardProps) {
  return (
    <div
      role="group"
      aria-label={title}
      className={`rounded-md border border-border bg-surface p-4 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-muted">{title}</p>
          <p
            className="mt-1 text-2xl font-semibold text-text-primary"
            aria-description={description}
          >
            {value}
          </p>
        </div>
        {icon ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-primary"
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
      {delta ? (
        <p className="mt-2 text-xs text-text-muted">{delta}</p>
      ) : null}
    </div>
  )
}

export default Card
