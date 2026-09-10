/**
 * Publishes {@link TelephonyEvent} to NATS using `subjectFor`.
 *
 * The `nats` npm package is an OPTIONAL runtime dependency: it is declared in
 * package.json but the import is lazy and wrapped in try/catch so that a
 * missing/failed module load degrades to a no-op publisher with a warning.
 * This lets the service run in local/dev without a NATS connection and lets
 * apps/api subscribe to the same subjects when NATS is present.
 */
import { createLogger, subjectFor, type TelephonyEvent } from '@pbx/common'

const log = createLogger('publisher')

type NatsConnection = {
  publish(subject: string, data: Uint8Array): void
  close(): Promise<void>
}

let natsUrl: string | undefined
let connection: NatsConnection | null = null
let initPromise: Promise<NatsConnection | null> | null = null
/** True once we have logged that NATS is unavailable, to avoid log spam. */
let warnedNoop = false

export function configurePublisher(url?: string): void {
  natsUrl = url
  // Reset state so a later reconfigure triggers a fresh connect attempt.
  connection = null
  initPromise = null
  warnedNoop = false
}

/**
 * Lazily connect to NATS. Resolves to a connection or null if the `nats`
 * package is unavailable / the URL is unset / connection fails. Never throws.
 */
function ensureConnection(): Promise<NatsConnection | null> {
  if (initPromise) return initPromise
  if (!natsUrl) {
    logOnceNoop('NATS_URL not set')
    return Promise.resolve(null)
  }
  initPromise = (async () => {
    try {
      // Lazy, isolated import so a missing dependency never crashes boot.
      const mod = (await import('nats')) as {
        connect: (opts: { servers: string }) => Promise<NatsConnection>
      }
      const conn = await mod.connect({ servers: natsUrl })
      log.info({ url: natsUrl }, 'NATS connected')
      connection = conn
      warnedNoop = false
      return conn
    } catch (err) {
      log.warn({ err, url: natsUrl }, 'NATS unavailable — events will be no-op')
      initPromise = null
      return null
    }
  })()
  return initPromise
}

function logOnceNoop(reason: string): void {
  if (warnedNoop) return
  warnedNoop = true
  log.warn({ reason }, 'telephony event publisher is in no-op fallback mode')
}

/**
 * Publish a {@link TelephonyEvent}. Determines the NATS subject from the
 * event kind (e.g. `call.started` → category `call`, event `started`) and
 * tenantId via {@link subjectFor}. If NATS is not configured, the event is
 * logged at debug and dropped — the caller's control flow never breaks.
 */
export async function publishEvent(evt: TelephonyEvent): Promise<void> {
  const [category, event] = evt.kind.split('.') as [string, string]
  const subject = subjectFor(evt.tenantId, category, event)
  const conn = await ensureConnection()
  if (!conn) {
    log.debug({ evt, subject }, 'publish skipped (no-op)')
    return
  }
  const payload = Buffer.from(JSON.stringify(evt), 'utf8')
  try {
    conn.publish(subject, payload)
    log.debug({ subject, kind: evt.kind }, 'published')
  } catch (err) {
    // Publishing failures are non-fatal: reset and retry next time.
    log.warn({ err, subject }, 'NATS publish failed — resetting connection')
    connection = null
    initPromise = null
  }
}

/** Drain and close the NATS connection on shutdown. */
export async function closePublisher(): Promise<void> {
  if (connection) {
    try {
      await connection.close()
    } catch {
      /* ignore */
    }
    connection = null
  }
  initPromise = null
}
