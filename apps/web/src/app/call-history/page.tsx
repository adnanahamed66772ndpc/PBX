'use client'

import { useEffect, useMemo, useState } from 'react'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { get, ApiError } from '@/lib/api'
import type { CallRecord, CallDirection, CallStatus, CallHistoryFilters } from '@/lib/types'
import { CALL_DIRECTION_LABEL, CALL_STATUS_LABEL } from '@/lib/types'

const STATUS_VARIANT: Record<CallStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  answered: 'success',
  noanswer: 'warning',
  busy: 'warning',
  failed: 'danger',
}

const DIRECTIONS: Array<CallDirection | 'all'> = ['all', 'in', 'out', 'internal']
const STATUSES: Array<CallStatus | 'all'> = ['all', 'answered', 'noanswer', 'busy', 'failed']

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-text-primary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

export default function CallHistoryPage() {
  const [records, setRecords] = useState<CallRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<CallHistoryFilters>({
    direction: 'all',
    status: 'all',
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await get<CallRecord[]>('/calls')
        if (!cancelled) setRecords(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load call history.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filters.direction && filters.direction !== 'all' && r.direction !== filters.direction) return false
      if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false
      return true
    })
  }, [records, filters])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Call History</h1>
        <p className="text-sm text-text-muted">CDR records for the current tenant.</p>
      </div>

      <fieldset className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
        <legend className="px-1 text-sm font-medium text-text-primary">Filters</legend>
        <Select
          label="Direction"
          value={filters.direction ?? 'all'}
          onChange={(v) => setFilters((f) => ({ ...f, direction: v as CallDirection | 'all' }))}
          options={DIRECTIONS.map((d) => ({ value: d, label: d === 'all' ? 'All' : CALL_DIRECTION_LABEL[d] }))}
        />
        <Select
          label="Status"
          value={filters.status ?? 'all'}
          onChange={(v) => setFilters((f) => ({ ...f, status: v as CallStatus | 'all' }))}
          options={STATUSES.map((s) => ({ value: s, label: s === 'all' ? 'All' : CALL_STATUS_LABEL[s] }))}
        />
        <Input
          type="search"
          placeholder="Filter by number…"
          wrapperClassName="w-56"
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          aria-label="Filter by number"
        />
      </fieldset>

      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}

      <Table<CallRecord>
        data={filtered}
        rowKey={(r) => r.call_id}
        emptyMessage={loading ? 'Loading call history…' : 'No calls match the current filters.'}
        columns={[
          {
            key: 'start_time',
            header: 'Time',
            render: (r) => new Date(r.start_time).toLocaleString(),
          },
          { key: 'from_ext', header: 'From', render: (r) => r.from_ext ?? r.did ?? '—' },
          { key: 'to_ext', header: 'To', render: (r) => r.to_ext ?? '—' },
          {
            key: 'duration_sec',
            header: 'Duration',
            render: (r) => `${r.duration_sec}s`,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <Badge variant={STATUS_VARIANT[r.status]} dot>{CALL_STATUS_LABEL[r.status]}</Badge>
            ),
          },
          {
            key: 'direction',
            header: 'Direction',
            render: (r) => CALL_DIRECTION_LABEL[r.direction],
          },
        ]}
      />
    </div>
  )
}
