'use client'

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  /** Wrapper className for layout (margin/width). */
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    leftIcon,
    wrapperClassName = '',
    id,
    className = '',
    ...rest
  },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedById = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={`flex flex-col gap-1 ${wrapperClassName}`}>
      {label ? (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
      ) : null}
      <div className="relative">
        {leftIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted">
            {leftIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          className={`w-full rounded-md border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            leftIcon ? 'pl-9' : ''
          } ${error ? 'border-danger' : 'border-border'} ${className}`}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
})

export default Input
