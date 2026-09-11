'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { get, ApiError, getToken } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import type {
  CallRecord,
  CallStatus,
  DashboardSummary,
  MetricCard,
} from '@/lib/types'
import { CALL_DIRECTION_LABEL, CALL_STATUS_LABEL } from '@/lib/types'

const STATUS_VARIANT: Record<CallStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  answered: 'success',
  noanswer: 'warning',
  busy: 'warning',
  failed: 'danger',
}

function MetricIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isViewer = user?.role === 'viewer'

  useEffect(() => {
    if (!getToken()) {
      router.push('/login')
      return
    }
    if (user && user.role === 'superadmin' && user.tenantId === null) {
      router.push('/tenants')
      return
    }
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await get<DashboardSummary>('/dashboard/summary')
        if (!cancelled) setSummary(data)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load dashboard data.'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, user])

  const metrics: MetricCard[] = summary
    ? [
        { title: 'Calls Today', value: summary.callsToday, icon: <MetricIcon path="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 0111 18.85a19.5 19.5 0 01-6-6A19.79 19.79 0 012 2.18 2 2 0 014 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" /> },
        { title: 'Active Calls', value: summary.activeCalls, icon: <MetricIcon path="M12 2v4M12 18v4M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h4M18 12h4" /> },
        { title: 'Agents Available', value: summary.agentsAvailable, icon: <MetricIcon path="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" /> },
        { title: 'Missed Calls', value: summary.missedCalls, icon: <MetricIcon path="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /> },
      ]
    : []

  function renderTable(): ReactNode {
    if (isViewer) {
      return (
        <p className="px-4 py-6 text-sm text-text-muted">
          You have viewer access. Call details are hidden — contact count only.
        </p>
      )
    }
    if (loading) {
      return <p className="px-4 py-6 text-text-muted">Loading recent calls…</p>
    }
    if (error) {
      return (
        <p className="px-4 py-6 text-danger" role="alert">
          {error}
        </p>
      )
    }
    return (
      <Table<CallRecord>
        data={summary?.recentCalls ?? []}
        rowKey={(r) => r.call_id}
        columns={[
          {
            key: 'start_time',
            header: 'Time',
            render: (r) => new Date(r.start_time).toLocaleTimeString(),
          },
          { key: 'from_ext', header: 'From', render: (r) => r.from_ext ?? '—' },
          { key: 'to_ext', header: 'To', render: (r) => r.to_ext ?? '—' },
          {
            key: 'direction',
            header: 'Direction',
            render: (r) => CALL_DIRECTION_LABEL[r.direction],
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <Badge variant={STATUS_VARIANT[r.status]} dot>
                {CALL_STATUS_LABEL[r.status]}
              </Badge>
            ),
          },
          {
            key: 'duration_sec',
            header: 'Duration',
            render: (r) => `${r.duration_sec}s`,
          },
        ]}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-muted">
          {isViewer ? 'Overview of call counts (viewer access).' : 'Realtime overview of your tenant.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-md border border-border bg-surface-subtle"
              aria-hidden="true"
            />
          ))
        ) : (
          metrics.map((m) => (
            <Card key={m.title} title={m.title} value={m.value} icon={m.icon} />
          ))
        )}
      </div>

      <section aria-label="Recent calls" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Recent Calls</h2>
        {renderTable()}
      </section>
    </div>
  )
}
