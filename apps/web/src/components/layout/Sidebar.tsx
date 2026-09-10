'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Presence } from '@pbx/db'
import { Badge } from '@/components/ui/Badge'

interface NavItem {
  href: string
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/dialer', label: 'Dialer', icon: 'phone' },
  { href: '/contacts', label: 'Contacts', icon: 'users' },
  { href: '/call-history', label: 'Call History', icon: 'clock' },
  { href: '/voicemail', label: 'Voicemail', icon: 'mail' },
]

const PRESENCE_VARIANT: Record<Presence, 'success' | 'warning' | 'danger' | 'neutral'> = {
  available: 'success',
  away: 'warning',
  dnd: 'danger',
  offline: 'neutral',
}

function NavIcon({ name }: { name: string }) {
  const common = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M22 6l-10 7L2 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    default:
      return null
  }
}

export interface SidebarProps {
  presence?: Presence
  userName?: string
  tenantName?: string
}

export function Sidebar({
  presence = 'available',
  userName = 'Agent',
  tenantName = 'PBX Tenant',
}: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger trigger (top-left) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        aria-controls="pbx-sidebar"
        className="fixed left-3 top-3 z-40 inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-text-primary md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        id="pbx-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{tenantName}</p>
            <p className="text-xs text-text-muted">PBX Console</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-hover md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[var(--token-primary)]/10 text-primary'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-sm font-semibold text-text-primary"
              aria-hidden="true"
            >
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">{userName}</p>
              <Badge variant={PRESENCE_VARIANT[presence]} dot>
                {presence}
              </Badge>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
