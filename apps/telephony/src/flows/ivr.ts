/**
 * IVR flow.
 *
 * Plays a greeting, collects DTMF digits from the caller via the
 * ChannelDtmfReceived ARI event, and routes the call by a menu map loaded
 * from the `ivrs` table (menu JSONB: `[{digit, destination}]`).
 *
 * The destination string follows the platform routing convention used by
 * inbound_routes:
 *   ext:1001   → bridge/continue to extension 1001
 *   queue:sales → hand off to queue.ts join
 *   ivr:main   → recurse into another IVR
 *
 * See telephony plan: IVR menus are first-class tenant resources; the menu
 * is authored in the control plane (apps/api) and stored in the `ivrs` table.
 */
import { createLogger } from '@pbx/common'
import { tx, type Ivr } from '@pbx/db'
import type { AriClient } from '../ari/client.js'
import type { AriEvent } from '../ari/types.js'
import { recordAnswer } from '../cdr/recorder.js'

const log = createLogger('ivr')

/** Result of resolving a digit — tells the stasis handler how to proceed. */
export interface IvrRouteResult {
  destination: string
  digit: string
}

/**
 * Run an IVR on a channel parked in Stasis.
 *
 * 1. Answer the channel (so media can be played).
 * 2. Play the greeting media (sound file path from the `ivrs.greeting` column).
 * 3. Subscribe to ChannelDtmfReceived on this channel and wait for a digit
 *    (with a timeout from ivrs.timeout).
 * 4. Look up the digit in the menu map; return the destination string.
 *
 * The caller (stasis.handler.ts) is responsible for acting on the returned
 * destination (continue to extension, join queue, or recurse into another IVR).
 */
export async function runIvr(
  ari: AriClient,
  channelId: string,
  tenantId: number,
  ivrId: number,
): Promise<IvrRouteResult | null> {
  // Load the IVR definition from the control-plane DB.
  const ivr = await loadIvr(tenantId, ivrId)
  if (!ivr) {
    log.warn({ channelId, ivrId }, 'IVR not found')
    await ari.hangup(channelId)
    return null
  }

  log.info({ channelId, ivr: ivr.name }, 'running IVR')
  await ari.answer(channelId)
  await recordAnswer(channelId)

  // Play greeting if configured. Greeting may be a sound:… URI or a file name.
  if (ivr.greeting) {
    const media = ivr.greeting.startsWith('sound:')
      ? ivr.greeting
      : `sound:${ivr.greeting}`
    try {
      await ari.play(channelId, media)
    } catch (err) {
      log.warn({ err, channelId, media }, 'IVR greeting playback failed')
    }
  }

  // Collect a single DTMF digit, with a timeout. We attach a one-shot listener
  // and race it against a timeout; on timeout we repeat the greeting once.
  const digit = await collectDigit(ari, channelId, ivr.timeout * 1000)
  if (digit == null) {
    log.info({ channelId }, 'IVR digit collection timed out')
    return null
  }

  const entry = ivr.menu.find((m) => m.digit === digit)
  if (!entry) {
    log.info({ channelId, digit }, 'IVR digit not in menu')
    return null
  }
  return { destination: entry.destination, digit }
}

async function loadIvr(tenantId: number, ivrId: number): Promise<Ivr | null> {
  try {
    return await tx(async (c) => {
      const res = await c.query<Ivr>(
        `SELECT id, tenant_id, name, greeting, menu, timeout, created_at::text
         FROM ivrs WHERE id = $1 AND tenant_id = $2`,
        [ivrId, tenantId],
      )
      const row = res.rows[0] as Ivr | undefined
      // menu is JSONB; pg returns it as a JS object already.
      if (row && typeof row.menu === 'string') {
        ;(row as { menu: unknown }).menu = JSON.parse(row.menu as unknown as string)
      }
      return row ?? null
    })
  } catch (err) {
    log.error({ err, ivrId }, 'failed to load IVR')
    return null
  }
}

/**
 * Wait for a single DTMF digit on a channel. Resolves to the digit string or
 * null on timeout. The listener is removed after the first digit or timeout.
 */
function collectDigit(ari: AriClient, channelId: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const onEvent = (evt: AriEvent) => {
      if (evt.type === 'ChannelDtmfReceived' && evt.channel?.id === channelId && evt.digit) {
        ari.off('ChannelDtmfReceived', onEvent)
        clearTimeout(timer)
        resolve(evt.digit)
      }
    }
    ari.on('ChannelDtmfReceived', onEvent)
    const timer = setTimeout(() => {
      ari.off('ChannelDtmfReceived', onEvent)
      resolve(null)
    }, timeoutMs)
  })
}
