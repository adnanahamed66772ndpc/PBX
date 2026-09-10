'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ThemeToggle } from './ThemeToggle'

export interface TopbarProps {
  tenantName?: string
  userName?: string
  onSearch?: (query: string) => void
  actions?: ReactNode
}

function UserMenu({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary hover:bg-surface-hover"
      >
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-subtle text-xs font-semibold"
          aria-hidden="true"
        >
          {userName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline">{userName}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <a href="/settings" role="menuitem" className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-hover">Settings</a>
          <a href="/profile" role="menuitem" className="block px-3 py-2 text-sm text-text-primary hover:bg-surface-hover">Profile</a>
          <hr className="border-border" />
          <a href="/login" role="menuitem" className="block px-3 py-2 text-sm text-danger hover:bg-surface-hover">Sign out</a>
        </div>
      ) : null}
    </div>
  )
}

export function Topbar({
  tenantName = 'PBX Tenant',
  userName = 'Agent',
  onSearch,
  actions,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface/95 px-4 pl-16 backdrop-blur md:pl-4">
      <div className="hidden items-center gap-2 md:flex">
        <span className="text-sm font-semibold text-text-primary">{tenantName}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
          workspace
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Search</span>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-text-muted" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Search contacts, calls, numbers..."
            onChange={(e) => onSearch?.(e.target.value)}
            aria-label="Search"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <UserMenu userName={userName} />
      </div>
    </header>
  )
}

export default Topbar
