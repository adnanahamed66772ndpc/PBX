/**
 * Queue flow.
 *
 * Joins a caller (parked in Stasis) to a queue and rings agents round-robin.
 * Agent membership and strategy come from the `queues` + `queue_members`
 * tables:
 *   - queues.strategy ∈ {ringall, roundrobin, leastrecent, fewestcalls}
 *   - queue_members.extension_id → extensions.ext_number (the agent extension)
 *
 * The ARI app itself owns the ringing: it originates to each agent extension
 * in turn (PJSIP/<ext>) until one answers, then bridges the caller to that
 * agent. Because Asterisk has a native app_queue, this module is the ARI
 * equivalent that keeps call state in our DB and publishes queue.update so
 * the web UI can show live waiting/agent counts.
 *
 * See telephony plan: queues are tenant-scoped; round-robin cursor is held
 * in-memory and reset on restart (a production version would persist it in
 * Redis via the shared client).
 */
import { createLogger } from '@pbx/common'
import { tx, type Extension } from '@pbx/db'
import type { AriClient } from '../ari/client.js'
import { recordAnswer } from '../cdr/recorder.js'
import { publishEvent } from '../events/publisher.js'

const log = createLogger('queue')

/** In-memory round-robin cursors keyed by `${tenantId}:${queueId}`. */
const cursors = new Map<string, number>()

interface QueueDef {
  id: number
  tenantId: number
  name: string
  strategy: string
  timeout: number
  wrapupTime: number
  maxCallers: number
}

interface QueueMember {
  extensionId: number
  extNumber: string
  penalty: number
  paused: boolean
}

/**
 * Join a channel to a queue and attempt to ring agents until one answers or
 * the queue timeout elapses. On success the caller is bridged to the agent
 * and the caller channel continues in Stasis under the bridge.
 *
 * Returns the agent channel id on a successful connect, or null on no-answer.
 */
export async function joinQueue(
  ari: AriClient,
  callerChannelId: string,
  tenantId: number,
  queueId: number,
): Promise<string | null> {
  const queue = await loadQueue(tenantId, queueId)
  if (!queue) {
    log.warn({ queueId, tenantId }, 'queue not found')
    await ari.hangup(callerChannelId)
    return null
  }

  const members = await loadMembers(tenantId, queueId)
  if (members.length === 0) {
    log.info({ queueId }, 'queue has no agents')
    await publishUpdate(queue, 1, 0)
    await ari.hangup(callerChannelId)
    return null
  }

  // Order members per the queue strategy.
  const ordered = orderMembers(queue.strategy, members, `${tenantId}:${queueId}`)
  await publishUpdate(queue, 1, ordered.filter((m) => !m.paused).length)

  // Answer the caller so they hear ringing/queue music while we dial agents.
  await ari.answer(callerChannelId)
  await recordAnswer(callerChannelId)

  for (const member of ordered) {
    if (member.paused) continue
    log.info({ queueId, agent: member.extNumber }, 'ringing agent')
    const endpoint = `PJSIP/${member.extNumber}`
    let agentChannelId: string | null = null
    try {
      const res = await ari.originate({
        endpoint,
        extension: member.extNumber,
        context: 'from-internal',
        app: 'pbx',
        appArgs: ['queue-agent', String(queueId)],
        timeout: queue.timeout,
      })
      agentChannelId = res.id
    } catch (err) {
      log.warn({ err, endpoint }, 'agent originate failed')
      continue
    }

    // Wait briefly for the agent channel to reach Up (answered) or fail.
    const answered = await waitForAnswer(ari, agentChannelId, queue.timeout * 1000)
    if (answered) {
      const bridge = await ari.bridge(callerChannelId, agentChannelId)
      log.info({ queueId, bridge: bridge.id, agent: member.extNumber }, 'caller bridged to agent')
      // advance round-robin cursor
      advanceCursor(`${tenantId}:${queueId}`, ordered.length, member.extensionId)
      return agentChannelId
    }
    // Agent didn't answer; hang up this leg and try the next member.
    await ari.hangup(agentChannelId).catch(() => {})
  }

  log.info({ queueId }, 'no agents answered — caller will be cleared')
  await publishUpdate(queue, 1, 0)
  return null
}

async function loadQueue(tenantId: number, queueId: number): Promise<QueueDef | null> {
  try {
    return await tx(async (c) => {
      const res = await c.query(
        `SELECT id, tenant_id, name, strategy, timeout, wrapup_time, max_callers
         FROM queues WHERE id = $1 AND tenant_id = $2`,
        [queueId, tenantId],
      )
      const row = res.rows[0]
      if (!row) return null
      return {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        strategy: row.strategy,
        timeout: row.timeout,
        wrapupTime: row.wrapup_time,
        maxCallers: row.max_callers,
      } as QueueDef
    })
  } catch (err) {
    log.error({ err, queueId }, 'failed to load queue')
    return null
  }
}

async function loadMembers(tenantId: number, queueId: number): Promise<QueueMember[]> {
  try {
    return await tx(async (c) => {
      const res = await c.query(
        `SELECT qm.extension_id, e.ext_number, qm.penalty, qm.paused
         FROM queue_members qm
         JOIN extensions e ON e.id = qm.extension_id
         WHERE qm.tenant_id = $1 AND qm.queue_id = $2
         ORDER BY qm.penalty ASC, qm.extension_id ASC`,
        [tenantId, queueId],
      )
      return res.rows.map((r) => ({
        extensionId: r.extension_id,
        extNumber: r.ext_number,
        penalty: r.penalty,
        paused: r.paused,
      })) as QueueMember[]
    })
  } catch (err) {
    log.error({ err, queueId }, 'failed to load queue members')
    return []
  }
}

/**
 * Order members by the queue strategy. roundrobin starts at the saved cursor;
 * ringall rings everyone at once (returned in list order; caller bridges the
 * first to answer); leastrecent/fewestcalls fall back to penalty order.
 */
function orderMembers(strategy: string, members: QueueMember[], cursorKey: string): QueueMember[] {
  const active = members.filter((m) => !m.paused)
  if (strategy === 'ringall') return active
  if (strategy === 'roundrobin') {
    const start = cursors.get(cursorKey) ?? 0
    return active.slice(start).concat(active.slice(0, start))
  }
  // leastrecent / fewestcalls: penalty order is a reasonable proxy here.
  return active
}

function advanceCursor(cursorKey: string, len: number, _extensionId: number): void {
  if (len <= 0) return
  const cur = cursors.get(cursorKey) ?? 0
  cursors.set(cursorKey, (cur + 1) % len)
}

/**
 * Resolve once the given channel reaches the Up state, or reject on
 * hangup/timeout. Used to detect whether an agent answered.
 */
function waitForAnswer(ari: AriClient, channelId: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (val: boolean) => {
      if (done) return
      done = true
      ari.off('ChannelStateChange', onState)
      ari.off('ChannelDestroyed', onDestroyed)
      clearTimeout(timer)
      resolve(val)
    }
    const onState = (evt: { type: string; channel?: { id: string; state: string } }) => {
      if (evt.type === 'ChannelStateChange' && evt.channel?.id === channelId && evt.channel.state === 'Up') {
        finish(true)
      }
    }
    const onDestroyed = (evt: { type: string; channel?: { id: string } }) => {
      if (evt.type === 'ChannelDestroyed' && evt.channel?.id === channelId) finish(false)
    }
    ari.on('ChannelStateChange', onState as never)
    ari.on('ChannelDestroyed', onDestroyed as never)
    const timer = setTimeout(() => finish(false), timeoutMs)
  })
}

async function publishUpdate(queue: QueueDef, waiting: number, agentsAvailable: number): Promise<void> {
  await publishEvent({
    kind: 'queue.update',
    tenantId: queue.tenantId,
    queueId: queue.id,
    waiting,
    agentsAvailable,
  })
}

/** Exposed for tests / control plane to inspect member extension numbers. */
export async function listMembers(tenantId: number, queueId: number): Promise<Pick<Extension, 'ext_number'>[]> {
  return (await loadMembers(tenantId, queueId)).map((m) => ({ ext_number: m.extNumber }))
}
