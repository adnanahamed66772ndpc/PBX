/**
 * @pbx/telephony bootstrap.
 *
 * Reads env, constructs the ARI client, connects the stasis event stream,
 * registers call-control flows, and starts the HTTP control API.
 *
 * Env:
 *   ARI_URL       http://asterisk:8088            (ARI HTTP base)
 *   ARI_USER      asterisk                         (ARI basic-auth user)
 *   ARI_PASSWORD  ********                          (set via envsubst in container)
 *   ARI_APP       pbx                              (Stasis app name, matches extensions.conf)
 *   NATS_URL      nats://nats:4222                 (optional; no-op fallback if unset)
 *   TELEPHONY_PORT 5000                           (HTTP control API)
 *   TELEPHONY_TOKEN ******                         (shared secret for apps/api)
 *   DATABASE_URL  postgres://…                      (@pbx/db pool)
 */
import { createLogger } from '@pbx/common'
import { closeDb } from '@pbx/db'
import { AriClient } from './ari/client.js'
import { registerStasisHandlers } from './flows/stasis.handler.js'
import { startHttpServer } from './http/server.js'
import { configurePublisher, closePublisher } from './events/publisher.js'

const log = createLogger('bootstrap')

const ARI_URL = process.env.ARI_URL ?? 'http://asterisk:8088'
const ARI_USER = process.env.ARI_USER ?? 'asterisk'
const ARI_PASSWORD = process.env.ARI_PASSWORD ?? ''
const ARI_APP = process.env.ARI_APP ?? 'pbx'
const NATS_URL = process.env.NATS_URL // optional
const TELEPHONY_PORT = parseInt(process.env.TELEPHONY_PORT ?? '5000', 10)

function required(name: string, value: string): string {
  if (!value) {
    log.error({ name }, 'required env var is missing')
    process.exit(1)
  }
  return value
}

async function main(): Promise<void> {
  // A rejected event-handler promise must never take the service down:
  // log it and keep serving calls. (Node kills the process on unhandled
  // rejections by default.)
  process.on('unhandledRejection', (reason) => {
    log.error({ err: reason }, 'unhandled rejection — continuing')
  })
  process.on('uncaughtException', (err) => {
    log.error({ err }, 'uncaught exception — continuing')
  })

  required('ARI_URL', ARI_URL)
  required('ARI_USER', ARI_USER)
  required('ARI_PASSWORD', ARI_PASSWORD)

  // Configure the (optional) NATS publisher. If NATS_URL is unset, publishEvent
  // becomes a no-op with a warning — the service still handles calls.
  configurePublisher(NATS_URL)

  // Construct + connect the ARI client.
  const ari = new AriClient({ url: ARI_URL, user: ARI_USER, password: ARI_PASSWORD, app: ARI_APP })
  registerStasisHandlers(ari)

  // Retry the initial connect a few times so we boot before Asterisk is up.
  await connectWithRetry(ari)

  // Start the HTTP control API used by apps/api.
  const server = startHttpServer(ari)

  // Graceful shutdown.
  const shutdown = (signal: string) => {
    log.info({ signal }, 'shutting down')
    ari.close()
    server.close()
    void closePublisher().finally(() => {
      void closeDb().finally(() => process.exit(0))
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  log.info({ port: TELEPHONY_PORT, app: ARI_APP }, '@pbx/telephony ready')
}

async function connectWithRetry(ari: AriClient, maxAttempts = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ari.connect()
      return
    } catch (err) {
      log.warn({ attempt, err: String(err) }, 'ARI connect failed — retrying')
      if (attempt === maxAttempts) {
        throw new Error(`could not connect to ARI after ${maxAttempts} attempts`)
      }
      await sleep(delayMs)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

main().catch((err) => {
  log.error({ err }, 'fatal bootstrap error')
  void closeDb().finally(() => process.exit(1))
})
