/**
 * CDR recorder.
 *
 * Consumes ARI lifecycle events to persist a `call_records` row per leg.
 * Strategy:
 *  - On StasisStart (call.entered pbx app): create a provisional row marked
 *    `status=failed` (default) so we always have a record even if the call
 *    never answers. We store start_time now and remember the row id by
 *    channel id.
 *  - On BridgeEnter / channel Up: set answer_time + status=answered.
 *  - On StasisEnd / ChannelDestroyed: set end_time, compute duration_sec
 *    (start→end) and billsec (answer→end), finalize status.
 *
 * Duration math is done here (server-side) rather than in SQL so the value
 * is deterministic and JSON-publishable on the way out.
 */
import { createLogger } from '@pbx/common'
import { tx, type CallDirection, type CallStatus } from '@pbx/db'
import type { AriEvent } from '../ari/types.js'
import { publishEvent } from '../events/publisher.js'

const log = createLogger('cdr')

/** In-memory state per channel until the row is finalised. */
interface CallLeg {
  callId: string
  channelId: string
  tenantId: number
  fromExt: string | null
  toExt: string | null
  did: string | null
  direction: CallDirection
  startTime: number
  answerTime: number | null
  status: CallStatus
}

/** channel id → leg. */
const legs = new Map<string, CallLeg>()

/** channel id → CDR row id (provisional row). */
const rowIds = new Map<string, number>()

/**
 * Seed a provisional row on StasisStart. We insert up front so a crash mid-
 * call still leaves a durable record; subsequent events UPDATE the same row.
 */
export async function recordStart(evt: AriEvent, tenantId: number, direction: CallDirection, fromExt: string | null, toExt: string | null, did: string | null): Promise<void> {
  if (!evt.channel) return
  const ch = evt.channel
  const now = Date.now()
  const leg: CallLeg = {
    callId: ch.id, // channel id doubles as call id in this minimal stack
    channelId: ch.id,
    tenantId,
    fromExt,
    toExt,
    did,
    direction,
    startTime: now,
    answerTime: null,
    status: 'failed', // reassessed below
  }
  legs.set(ch.id, leg)

  try {
    const id = await tx(async (c) => {
      const ins = await c.query<{ id: number }>(
        `INSERT INTO call_records
           (tenant_id, call_id, channel_id, from_ext, to_ext, did, direction, status, start_time, duration_sec, billsec)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9::double precision), 0, 0)
         RETURNING id`,
        [tenantId, ch.id, ch.id, fromExt, toExt, did, direction, leg.status, now / 1000],
      )
      return ins.rows[0].id
    })
    rowIds.set(ch.id, id)
    await publishEvent({
      kind: 'call.started',
      tenantId,
      callId: leg.callId,
      from: fromExt ?? '',
      to: toExt ?? '',
      direction,
    })
  } catch (err) {
    log.error({ err, channelId: ch.id }, 'failed to insert call_records row')
  }
}

/** Mark a channel as answered (BridgeEnter or channel Up). Idempotent. */
export async function recordAnswer(channelId: string): Promise<void> {
  const leg = legs.get(channelId)
  if (!leg || leg.answerTime) return
  leg.answerTime = Date.now()
  leg.status = 'answered'
  const id = rowIds.get(channelId)
  if (id == null) return
  try {
    await tx(async (c) => {
      await c.query(
        `UPDATE call_records SET answer_time = to_timestamp($1::double precision), status = $2
         WHERE id = $3`,
        [leg.answerTime! / 1000, leg.status, id],
      )
    })
    await publishEvent({
      kind: 'call.answered',
      tenantId: leg.tenantId,
      callId: leg.callId,
      extensionId: leg.toExt ? parseInt(leg.toExt, 10) || null : null,
    })
  } catch (err) {
    log.error({ err, channelId }, 'failed to update answer_time')
  }
}

/** Finalise a row on StasisEnd / ChannelDestroyed. */
export async function recordEnd(channelId: string, disposition?: string): Promise<void> {
  const leg = legs.get(channelId)
  const id = rowIds.get(channelId)
  if (!leg) return
  const now = Date.now()
  const durationSec = Math.max(0, Math.round((now - leg.startTime) / 1000))
  const billsec = leg.answerTime
    ? Math.max(0, Math.round((now - leg.answerTime) / 1000))
    : 0
  // If the channel never answered, the final status is noanswer (or busy if
  // a busy disposition was recorded earlier); otherwise keep the answered
  // status set in recordAnswer.
  if (!leg.answerTime) {
    leg.status = leg.status === 'busy' ? 'busy' : 'noanswer'
  }
  try {
    if (id != null) {
      await tx(async (c) => {
        await c.query(
          `UPDATE call_records
           SET end_time = to_timestamp($1::double precision),
               duration_sec = $2,
               billsec = $3,
               status = $4,
               disposition = COALESCE($5, disposition)
           WHERE id = $6`,
          [now / 1000, durationSec, billsec, leg.status, disposition ?? null, id],
        )
      })
    }
    await publishEvent({
      kind: 'call.ended',
      tenantId: leg.tenantId,
      callId: leg.callId,
      durationSec,
      status: leg.status,
    })
  } catch (err) {
    log.error({ err, channelId }, 'failed to finalise call_records row')
  } finally {
    legs.delete(channelId)
    rowIds.delete(channelId)
  }
}

/** Honour ARI BridgeEnter/Leave for answer/bill accounting. */
export function handleBridgeEvent(evt: AriEvent): Promise<void> {
  if (evt.type === 'BridgeEnter' && evt.channel) {
    return recordAnswer(evt.channel.id)
  }
  if (evt.type === 'BridgeLeave' && evt.channel) {
    // Leaving the bridge ends talk time but not the channel; nothing to write.
    return Promise.resolve()
  }
  return Promise.resolve()
}
