'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { get, post, setToken, getToken, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import type { Tenant, AuthLoginResponse } from '@/lib/types'

export default function TenantsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [switching, setSwitching] = useState<number | null>(null)

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    if (user && user.role !== 'superadmin') {
      router.push('/dashboard')
      return
    }
    let cancelled = false
    async function load() {
      try {
        const data = await get<Tenant[]>('/tenants')
        if (!cancelled) {
          setTenants(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load tenants')
          setLoading(false)
        }
      }
    }
    if (user?.role === 'superadmin') load()
    return () => { cancelled = true }
  }, [router, user])

  async function switchTo(tenant: Tenant) {
    setSwitching(tenant.id)
    setError(null)
    try {
      const res = await post<AuthLoginResponse>('/auth/switch-tenant', { tenantId: tenant.id })
      setToken(res.accessToken)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to switch tenant')
    } finally {
      setSwitching(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="text-sm text-text-muted">Loading tenants…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Tenants</h1>
        <p className="text-sm text-text-muted">
          Select a tenant to manage. You will be scoped to the selected tenant after switching.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-[var(--token-danger)]/30 bg-[var(--token-danger)]/10 px-4 py-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tenants.map((t) => {
          const isCurrent = user?.tenantId === t.id
          return (
            <div key={t.id} className="rounded-md border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-muted">{t.name}</p>
                  <p className="text-lg font-semibold text-text-primary">{t.plan}</p>
                </div>
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={t.active ? 'success' : 'neutral'} dot>{t.active ? 'Active' : 'Inactive'}</Badge>
                  {t.domain ? (
                    <span className="text-xs text-text-muted">{t.domain}</span>
                  ) : null}
                  {isCurrent ? (
                    <Badge variant="info">Current</Badge>
                  ) : null}
                </div>
                <Button
                  onClick={() => switchTo(t)}
                  loading={switching === t.id}
                  disabled={isCurrent}
                  size="sm"
                >
                  {isCurrent ? 'Selected' : 'Switch'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
