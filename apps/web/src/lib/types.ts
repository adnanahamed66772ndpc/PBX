/**
 * Domain type re-exports and UI-only types.
 *
 * The authoritative domain entities live in `@pbx/db` (mirrors the SQL
 * schema). `@pbx/common` contributes the telephony event contract. We
 * re-export the union our UI actually consumes and add the small set of
 * UI-only shapes that do not belong in the schema package (e.g. API
 * envelopes, metric cards, keypad layout).
 *
 * These are type-only imports so no Node-only code from `@pbx/db`
 * (the `pg` client) is bundled into the browser.
 */
import type React from 'react'
import type {
  CallRecord,
  CallDirection,
  CallStatus,
  Extension,
  Presence,
  Role,
  Tenant,
  User,
} from '@pbx/db'
import type { TelephonyEvent } from '@pbx/common'

export type {
  CallRecord,
  CallDirection,
  CallStatus,
  Extension,
  Presence,
  Role,
  Tenant,
  User,
}

export type { TelephonyEvent }

/* ---------- API envelopes ---------- */

export interface AuthLoginRequest {
  email: string
  password: string
}

export interface SafeUser {
  id: number
  tenantId: number
  email: string
  fullName: string | null
  role: Role
  presence: Presence
  active: boolean
  twoFactorEnabled: boolean
}

export interface AuthLoginResponse {
  accessToken: string
  refreshToken: string
  expiresIn: string
  user: SafeUser
}

export interface ApiErrorBody {
  code?: string
  message?: string
  details?: Record<string, unknown>
}

/* ---------- UI-only types ---------- */

export interface MetricCard {
  title: string
  value: number | string
  icon?: string
  delta?: string
}

export interface DashboardSummary {
  callsToday: number
  activeCalls: number
  agentsAvailable: number
  missedCalls: number
  recentCalls: CallRecord[]
}

export interface Contact {
  id: number
  fullName: string
  email?: string | null
  extension: string
  phone: string
  department: string
}

export interface Voicemail {
  id: number
  from: string
  to: string
  durationSec: number
  receivedAt: string
  read: boolean
  transcription?: string | null
  audioUrl: string
}

export interface CallHistoryFilters {
  direction?: CallDirection | 'all'
  status?: CallStatus | 'all'
  from?: string
  to?: string
}

export interface TableColumn<T> {
  key: string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  className?: string
}

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

export type DialerPresence = 'available' | 'away' | 'dnd' | 'offline'

export interface KeypadKey {
  digit: string
  sub?: string
}

export const CALL_DIRECTION_LABEL: Record<CallDirection, string> = {
  in: 'Inbound',
  out: 'Outbound',
  internal: 'Internal',
}

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  answered: 'Answered',
  noanswer: 'No Answer',
  busy: 'Busy',
  failed: 'Failed',
}
