/**
 * Tiny HTTP control API for apps/api call-control.
 *
 * Endpoints:
 *   GET  /healthz                          liveness probe
 *   POST /originate   { fromExt, to, tenantId?, context? }  → { channelId }
 *   POST /hangup      { channelId }        → { ok: true }
 *
 * Security: every mutating request must carry a shared-secret header
 *   X-Telephony-Token: <TELEPHONY_TOKEN env value>
 * set by apps/api. /healthz is exempt so k8s/docker probes can hit it.
 * The token is compared with a constant-time check to avoid timing oracles.
 * In production this should sit behind mTLS / a private network; the token
 * is a second layer, not the only one.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createLogger, AppError, Errors } from '@pbx/common'
import type { AriClient } from '../ari/client.js'

const log = createLogger('http')

const TELEPHONY_TOKEN = process.env.TELEPHONY_TOKEN ?? ''
const PORT = parseInt(process.env.TELEPHONY_PORT ?? '5000', 10)

interface OriginateBody {
  fromExt?: string
  to?: string
  tenantId?: number
  context?: string
}

interface HangupBody {
  channelId?: string
}

export function startHttpServer(ari: AriClient): Server {
  const server = createServer((req, res) => {
    // Always JSON out; wrap handler errors in AppError.
    const handle = async () => {
      try {
        if (req.method === 'GET' && req.url === '/healthz') {
          return sendJson(res, 200, { status: 'ok' })
        }
        if (!checkToken(req)) {
          throw Errors.unauthorized()
        }
        if (req.method === 'POST' && req.url === '/originate') {
          const body = await readJson<OriginateBody>(req)
          return await handleOriginate(ari, res, body)
        }
        if (req.method === 'POST' && req.url === '/hangup') {
          const body = await readJson<HangupBody>(req)
          return await handleHangup(ari, res, body)
        }
        throw Errors.notFound(`route ${req.method} ${req.url}`)
      } catch (err) {
        const ae =
          err instanceof AppError
            ? err
            : new AppError('internal_error', 'telephony http error', 500, { cause: err })
        log.warn({ err: ae, url: req.url }, 'request failed')
        sendJson(res, ae.status, { error: ae.message, code: ae.code })
      }
    }
    void handle()
  })

  server.listen(PORT, () => {
    log.info({ port: PORT }, 'telephony http server listening')
  })
  return server
}

async function handleOriginate(ari: AriClient, res: ServerResponse, body: OriginateBody): Promise<void> {
  if (!body.to) throw Errors.validation('to is required')
  if (!body.fromExt) throw Errors.validation('fromExt is required')
  // Click-to-call: ring the caller's own endpoint first; when it enters
  // Stasis with the `dial:<to>` arg, the stasis handler routes the call to
  // the destination (extension → bridge, no-answer → voicemail).
  const result = await ari.originate({
    endpoint: `PJSIP/${body.fromExt}`,
    app: 'pbx',
    appArgs: [`dial:${body.to}`, String(body.tenantId ?? 1)],
    callerId: `Extension ${body.fromExt}`,
    timeout: 60,
  })
  sendJson(res, 201, { channelId: result.id, name: result.name })
}

async function handleHangup(ari: AriClient, res: ServerResponse, body: HangupBody): Promise<void> {
  if (!body.channelId) throw Errors.validation('channelId is required')
  try {
    await ari.hangup(body.channelId)
  } catch (err) {
    // A channel that already terminated is a successful hangup.
    const status = (err as { status?: number }).status
    if (status !== 404) throw err
  }
  sendJson(res, 200, { ok: true })
}

// ── helpers ───────────────────────────────────────────────────────────

function checkToken(req: IncomingMessage): boolean {
  if (req.method === 'GET' && req.url === '/healthz') return true
  const provided = req.headers['x-telephony-token']
  if (typeof provided !== 'string' || !TELEPHONY_TOKEN) return false
  // constant-time-ish comparison
  const a = Buffer.from(provided)
  const b = Buffer.from(TELEPHONY_TOKEN)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T))
      } catch {
        reject(Errors.validation('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(payload)
}
