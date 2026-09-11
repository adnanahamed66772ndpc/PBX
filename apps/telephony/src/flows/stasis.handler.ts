/**
 * Stasis event handler.
 *
 * Asterisk sends channels into the `pbx` Stasis application via the dialplan
 * (extensions.conf: `Stasis(pbx,${EXTEN})`). This module wires ARI events to
 * call-control flows:
 *
 *   StasisStart  → route by tenant + destination:
 *                    - ext:<n>      bridge/continue to an extension
 *                    - ivr:<id>     run the IVR flow
 *                    - queue:<id>   join the queue flow
 *                    - inbound DID  look up inbound_routes.destination
 *   StasisEnd    → tear down per-channel state (CDR finalisation)
 *   ChannelDestroyed → finalise CDR if not already done
 *   BridgeEnter/Leave → forward to the CDR recorder for answer/bill accounting
 *
 * Tenant resolution: the platform is multi-tenant. For inbound calls the
 * tenant is derived from the DID (did_numbers → tenant_id) in apps/api and
 * passed here as a Stasis arg by the HTTP originate path; for internal/out
 * legs the tenant is derived from the originating extension (extensions →
 * tenant_id). The `args[0]` is the dialled extension; `args[1]`, when present,
 * is the tenantId (set by apps/api on originate). When absent we default to
 * tenantId 1 (the bootstrap tenant) so local dev calls still work.
 *
 * See telephony plan: IVR and queue routing map directly to the control-
 * plane tables `ivrs` and `queues`; the destination string grammar
 * (ext:|ivr:|queue:) is shared with inbound_routes.destination.
 */
import { createLogger } from '@pbx/common'
import { tx } from '@pbx/db'
import type { AriClient } from '../ari/client.js'
import type { AriEvent } from '../ari/types.js'
import { runIvr } from './ivr.js'
import { joinQueue } from './queue.js'
import { recordStart, recordEnd, handleBridgeEvent } from '../cdr/recorder.js'

const log = createLogger('stasis')

/** The dialplan context app_voicemail lives in (see extensions.conf [pbx-vm]). */
const VOICEMAIL_CONTEXT = process.env.VOICEMAIL_CONTEXT ?? 'pbx-vm'

/**
 * Lifecycle of one internal extension dial (caller → destination leg).
 * `answered` is set by BridgeEnter; on destination termination we either
 * continue the caller into the voicemail context (no-answer) or tear the
 * bridge + remaining leg down.
 */
interface ExtDial {
  callerId: string
  destId: string
  bridgeId: string
  ext: string
  tenantId: number
  answered: boolean
  finished: boolean
}

/** callerId → in-flight ext dial. */
const extDials = new Map<string, ExtDial>()
/** destLegId → callerId, so termination events on the dest leg find their dial. */
const destToCaller = new Map<string, string>()

function finishDial(dial: ExtDial): void {
  if (dial.finished) return
  dial.finished = true
  extDials.delete(dial.callerId)
  destToCaller.delete(dial.destId)
}

export function registerStasisHandlers(ari: AriClient): void {
  ari.on('StasisStart', (evt: AriEvent) => onStasisStart(ari, evt))
  ari.on('StasisEnd', (evt: AriEvent) => void onChannelGone(ari, evt))
  ari.on('ChannelDestroyed', (evt: AriEvent) => {
    if (evt.channel) void recordEnd(evt.channel.id, 'destroyed')
    void onChannelGone(ari, evt)
  })
  ari.on('BridgeEnter', (evt: AriEvent) => {
    void handleBridgeEvent(evt)
    // A destination leg entering a bridge means the called party answered.
    const callerId = evt.channel ? destToCaller.get(evt.channel.id) : undefined
    const dial = callerId ? extDials.get(callerId) : undefined
    if (dial && evt.channel && evt.channel.id === dial.destId) {
      dial.answered = true
      log.info({ callerId: dial.callerId, destId: dial.destId, ext: dial.ext }, 'destination answered')
    }
  })
  ari.on('BridgeLeave', (evt: AriEvent) => void handleBridgeEvent(evt))
}

/**
 * Shared termination path for StasisEnd and ChannelDestroyed (a channel that
 * terminates fires both — the first one finishes the dial, the second no-ops):
 *  - destination leg ended → continue the caller to voicemail if it was never
 *    answered, otherwise tear the call down;
 *  - caller leg ended while the destination was still ringing → cancel the
 *    destination leg (prevents orphan ringing channels).
 */
async function onChannelGone(ari: AriClient, evt: AriEvent): Promise<void> {
  const channelId = evt.channel?.id
  if (!channelId) return

  // Destination leg terminated.
  const callerId = destToCaller.get(channelId)
  if (callerId) {
    const dial = extDials.get(callerId)
    if (!dial) return
    finishDial(dial)
    await ari.destroyBridge(dial.bridgeId).catch(() => {})
    if (!dial.answered) {
      log.info({ callerId, ext: dial.ext, tenantId: dial.tenantId }, 'no-answer → routing caller to voicemail')
      try {
        await ari.continueChannel(callerId, VOICEMAIL_CONTEXT, dial.ext)
      } catch (err) {
        log.warn({ err, callerId }, 'voicemail continue failed — hanging up caller')
        await ari.hangup(callerId).catch(() => {})
      }
    } else {
      await ari.hangup(callerId).catch(() => {})
    }
    return
  }

  // Caller leg terminated while the destination leg was still ringing.
  const dial = extDials.get(channelId)
  if (dial && !dial.finished) {
    log.info({ channelId, destId: dial.destId, ext: dial.ext }, 'caller cancelled while ringing — hanging up destination leg')
    finishDial(dial)
    await ari.destroyBridge(dial.bridgeId).catch(() => {})
    await ari.hangup(dial.destId).catch(() => {})
  }
}

async function onStasisStart(ari: AriClient, evt: AriEvent): Promise<void> {
  const channel = evt.channel
  if (!channel) return
  const args = evt.args ?? []
  const dialled = args[0] ?? channel.dialplan.exten ?? ''
  // If this channel was originated by us as a destination leg, it has the
  // 'dialed:NNN' arg — don't re-route, just wait to enter the bridge.
  if (dialled.startsWith('dialed:')) {
    log.info({ channelId: channel.id, dialled }, 'StasisStart — outgoing leg, waiting for bridge')
    return
  }
  // Click-to-call caller leg: the HTTP originate path creates it with
  // 'dial:<to>' — this channel is the caller; route to the target now.
  if (dialled.startsWith('dial:')) {
    const target = dialled.slice(5)
    const tenantId = args[1] ? parseInt(args[1], 10) : 1
    const fromExt = channel.caller?.number ?? null
    log.info({ channelId: channel.id, target, tenantId, from: fromExt }, 'StasisStart — click-to-call caller leg')
    await recordStart(evt, tenantId, 'internal', fromExt, target, null)
    await route(ari, channel.id, tenantId, `ext:${target}`, target)
    return
  }
  // tenantId may be passed by apps/api originate; default to bootstrap tenant.
  const tenantId = args[1] ? parseInt(args[1], 10) : await resolveTenant(dialled) ?? 1
  const fromExt = channel.caller?.number ?? null
  const toExt = dialled
  log.info({ channelId: channel.id, dialled, tenantId, from: fromExt }, 'StasisStart')

  // Provisional CDR row + call.started event.
  const direction = inferDirection(channel, fromExt, dialled)
  await recordStart(evt, tenantId, direction, fromExt, toExt, direction === 'in' ? dialled : null)

  // Route. A Stasis arg may already encode a destination (ivr:2, queue:3);
  // otherwise treat the dialled string as an extension number (ext:…).
  const dest = await resolveDestination(dialled, tenantId)
  await route(ari, channel.id, tenantId, dest, toExt)
}

// ── routing helpers ───────────────────────────────────────────────────

/** Determine where a call should go, consulting inbound_routes for DID. */
async function resolveDestination(dialled: string, tenantId: number): Promise<string> {
  // If the dialled string already looks like a routed destination, keep it.
  if (/^(ext|ivr|queue):/.test(dialled)) return dialled
  // Otherwise assume it's a DID → look up inbound_routes.destination.
  try {
    const dest = await tx(async (c) => {
      const res = await c.query<{ destination: string }>(
        `SELECT ir.destination
         FROM did_numbers d
         JOIN inbound_routes ir ON ir.id = d.inbound_route_id
         WHERE d.number = $1 AND d.tenant_id = $2 AND d.active AND ir.id IS NOT NULL
         LIMIT 1`,
        [dialled, tenantId],
      )
      return res.rows[0]?.destination ?? null
    })
    if (dest) return dest
  } catch (err) {
    log.warn({ err, dialled }, 'inbound route lookup failed')
  }
  // Fall back to treating the dialled string as an internal extension.
  return `ext:${dialled}`
}

/** Resolve tenant id from the dialled DID or originating extension. */
async function resolveTenant(dialled: string): Promise<number | null> {
  try {
    return await tx(async (c) => {
      const did = await c.query<{ tenant_id: number }>(
        'SELECT tenant_id FROM did_numbers WHERE number = $1 AND active LIMIT 1',
        [dialled],
      )
      if (did.rows[0]) return did.rows[0].tenant_id
      const ext = await c.query<{ tenant_id: number }>(
        'SELECT tenant_id FROM extensions WHERE ext_number = $1 LIMIT 1',
        [dialled],
      )
      return ext.rows[0]?.tenant_id ?? null
    })
  } catch {
    return null
  }
}

function inferDirection(
  channel: NonNullable<AriEvent['channel']>,
  fromExt: string | null,
  dialled: string,
): 'in' | 'out' | 'internal' {
  // A channel with no caller id entering from the public dialplan context is
  // an inbound leg; a channel originated by apps/api with a PJSIP endpoint
  // caller id is internal/out.
  if (channel.dialplan.context === 'from-trunk' || (channel.dialplan.app === 'pbx' && !fromExt)) {
    return 'in'
  }
  if (fromExt && dialled && !/^\d{3,4}$/.test(dialled)) return 'out'
  return 'internal'
}

/**
 * Dispatch to the right flow. The grammar mirrors inbound_routes.destination:
 *   ext:<number>     continue the channel to that extension in from-internal
 *   ivr:<id>         run the IVR; on digit, route to its destination
 *   queue:<id>       join the queue flow
 */
async function route(ari: AriClient, channelId: string, tenantId: number, destination: string, toExt: string): Promise<void> {
  const [kind, rest] = destination.split(':')
  switch (kind) {
    case 'ext': {
      const ext = rest ?? toExt
      // Answer the incoming channel, then originate the destination endpoint
      // and bridge both legs. We pass appArgs=['dialed:NNN'] so the outgoing
      // leg's StasisStart handler knows it's the called side (no re-routing).
      await ari.answer(channelId).catch(() => {})
      let destChannel: { id: string; name: string } | null = null
      try {
        destChannel = await ari.originate({
          endpoint: `PJSIP/${ext}`,
          app: 'pbx',
          appArgs: [`dialed:${ext}`, String(tenantId)],
          callerId: `Extension ${ext}`,
          timeout: 30,
        })
      } catch (err) {
        log.warn({ err, ext }, 'originate to extension failed — hanging up')
        await ari.hangup(channelId).catch(() => {})
        return
      }
      // Track the dial so termination events can fall back to voicemail or
      // cancel the ringing leg (see onChannelGone).
      extDials.set(channelId, {
        callerId: channelId,
        destId: destChannel.id,
        bridgeId: '',
        ext,
        tenantId,
        answered: false,
        finished: false,
      })
      destToCaller.set(destChannel.id, channelId)
      const dial = extDials.get(channelId)!
      const br = await ari.createBridge('mixing')
      dial.bridgeId = br.id
      await ari.addChannelsToBridge(br.id, channelId, destChannel.id)
      log.info({ channelId, destId: destChannel.id, bridgeId: br.id, ext }, 'ext bridge created')
      return
    }
    case 'ivr': {
      const ivrId = parseInt(rest, 10)
      const result = await runIvr(ari, channelId, tenantId, ivrId)
      if (result) {
        // Recurse: route by the IVR's chosen destination.
        await route(ari, channelId, tenantId, result.destination, toExt)
      }
      return
    }
    case 'queue': {
      const queueId = parseInt(rest, 10)
      await joinQueue(ari, channelId, tenantId, queueId)
      return
    }
    default:
      log.warn({ channelId, destination }, 'unknown destination kind — hanging up')
      await ari.hangup(channelId).catch(() => {})
  }
}
