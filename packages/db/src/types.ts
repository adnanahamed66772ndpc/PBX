/**
 * Lightweight domain types shared across the control plane.
 * These mirror the SQL schema in packages/db/migrations.
 */

export type Role = 'superadmin' | 'owner' | 'admin' | 'manager' | 'agent' | 'user' | 'viewer'
export type Presence = 'available' | 'away' | 'dnd' | 'offline'
export type CallDirection = 'in' | 'out' | 'internal'
export type CallStatus = 'answered' | 'noanswer' | 'busy' | 'failed'

export interface Tenant {
  id: number
  name: string
  domain?: string | null
  plan: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: number
  tenant_id: number | null
  email: string
  full_name?: string | null
  role: Role
  presence: Presence
  totp_secret?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Extension {
  id: number
  tenant_id: number
  user_id?: number | null
  ext_number: string
  secret: string
  caller_id?: string | null
  context: string
  webrtc: boolean
  created_at: string
  updated_at: string
}

export interface SipTrunk {
  id: number
  tenant_id: number
  name: string
  hostname: string
  port: number
  transport: string
  username?: string | null
  password?: string | null
  active: boolean
  created_at: string
}

export interface InboundRoute {
  id: number
  tenant_id: number
  name: string
  description?: string | null
  destination: string // e.g. ivr:main, queue:sales, ext:1001
  priority: number
  created_at: string
}

export interface DidNumber {
  id: number
  tenant_id: number
  number: string
  inbound_route_id?: number | null
  active: boolean
  created_at: string
}

export interface Queue {
  id: number
  tenant_id: number
  name: string
  strategy: string
  timeout: number
  wrapup_time: number
  max_callers: number
  created_at: string
}

export interface Ivr {
  id: number
  tenant_id: number
  name: string
  greeting?: string | null
  menu: Array<{ digit: string; destination: string }>
  timeout: number
  created_at: string
}

export interface CallRecord {
  id: number
  tenant_id: number
  call_id: string
  channel_id?: string | null
  from_ext?: string | null
  to_ext?: string | null
  did?: string | null
  direction: CallDirection
  status: CallStatus
  start_time: string
  answer_time?: string | null
  end_time?: string | null
  duration_sec: number
  billsec: number
  disposition?: string | null
  recording_url?: string | null
}

export interface Contact {
  id: number
  tenant_id: number
  full_name: string
  email?: string | null
  phone: string
  extension?: string | null
  department?: string | null
  created_at: string
  updated_at: string
}
