/**
 * Shared event contract published by the telephony service onto NATS
 * and republished to connected web clients over WebSocket.
 *
 * Subjects follow the convention: `pbx.<tenantId>.<category>.<event>`
 * e.g. pbx.42.call.started
 */
export type TelephonyEvent =
  | { kind: 'call.started'; tenantId: number; callId: string; from: string; to: string; direction: 'in' | 'out' | 'internal' }
  | { kind: 'call.answered'; tenantId: number; callId: string; extensionId: number | null }
  | { kind: 'call.ended'; tenantId: number; callId: string; durationSec: number; status: string }
  | { kind: 'presence.changed'; tenantId: number; userId: number; presence: string }
  | { kind: 'queue.update'; tenantId: number; queueId: number; waiting: number; agentsAvailable: number }

export const subjectFor = (tenantId: number, category: string, event: string): string =>
  `pbx.${tenantId}.${category}.${event}`
