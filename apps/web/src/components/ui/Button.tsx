'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  fullWidth?: boolean
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:cursor-not-allowed select-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-text-inverted hover:bg-[var(--token-primary-hover)] shadow-sm',
  secondary:
    'bg-surface text-text-primary border border-border hover:bg-surface-hover',
  danger:
    'bg-danger text-text-inverted hover:bg-[var(--token-danger-hover)] shadow-sm',
  ghost:
    'bg-transparent text-text-primary hover:bg-surface-hover border border-transparent',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  )
})

export default Button
