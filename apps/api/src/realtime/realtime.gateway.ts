import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { IncomingMessage, Server as HttpServer } from 'http'
import type { Duplex } from 'stream'
import { WebSocketServer, type WebSocket } from 'ws'
import { getDb } from '@pbx/db'
import type { TelephonyEvent } from '@pbx/common'
import { EventsService } from '../modules/events/events.service'

/**
 * Realtime gateway: relays telephony events from NATS to browsers.
 *
 * Transport is a plain WebSocket at `/realtime` (behind Nginx:
 * `wss://<host>/api/realtime`). Browsers cannot set an Authorization header
 * on a native WebSocket, so the access token travels as the `token` query
 * parameter on the upgrade request.
 *
 * Tenancy: after verifying the JWT the user is reloaded from the database —
 * their DB role/tenant are authoritative. The one exception is superadmin,
 * whose effective tenant comes from the token (switching): `tenantId = null`
 * means the platform view and receives every tenant's events.
 */
interface Client {
  ws: WebSocket
  userId: number
  role: string
  /** null = superadmin without a switched tenant → receives all events. */
  tenantId: number | null
  alive: boolean
}

@Injectable()
export class RealtimeGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeGateway.name)
  private readonly wss = new WebSocketServer({ noServer: true })
  private readonly clients = new Set<Client>()
  private keepalive: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly events: EventsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const server = this.adapterHost.httpAdapter.getHttpServer() as HttpServer
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      if (url.pathname !== '/realtime') return // not ours — leave the socket untouched
      const token = url.searchParams.get('token') ?? ''
      this.authenticate(token)
        .then((client) => {
          this.wss.handleUpgrade(req, socket, head, (ws) => this.attach(client, ws))
        })
        .catch(() => {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
          socket.destroy()
        })
    })

    this.keepalive = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          this.clients.delete(client)
          client.ws.terminate()
          continue
        }
        client.alive = false
        client.ws.ping()
      }
    }, 30_000)

    await this.events.onEvent((event) => this.broadcast(event))
    this.logger.log('Realtime gateway ready on /realtime')
  }

  onModuleDestroy(): void {
    if (this.keepalive) clearInterval(this.keepalive)
    for (const client of this.clients) client.ws.terminate()
    this.clients.clear()
    this.wss.close()
  }

  /** Verify the JWT, reload the user from DB, return client metadata. */
  private async authenticate(token: string): Promise<Omit<Client, 'ws' | 'alive'>> {
    let payload: { sub?: number | string; role?: string; tenantId?: number | null }
    try {
      payload = await this.jwt.verifyAsync(token)
    } catch {
      throw new Error('invalid token')
    }
    const userId = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub
    if (!userId || Number.isNaN(userId)) throw new Error('no subject')
    const db = getDb()
    const { rows } = await db.query<{ role: string; tenant_id: number | null }>(
      'SELECT role, tenant_id FROM users WHERE id = $1',
      [userId],
    )
    if (!rows.length) throw new Error('user not found')
    const user = rows[0]
    const tenantId = user.role === 'superadmin' ? payload.tenantId ?? null : user.tenant_id
    return { userId, role: user.role, tenantId }
  }

  private attach(client: Omit<Client, 'ws' | 'alive'>, ws: WebSocket): void {
    const full: Client = { ...client, ws, alive: true }
    ws.on('pong', () => {
      full.alive = true
    })
    ws.on('close', (code, reason) => {
      this.logger.warn(`client closed userId=${full.userId} code=${code} reason=${reason.toString()}`)
      this.clients.delete(full)
    })
    ws.on('error', (err) => {
      this.logger.warn(`client error userId=${full.userId}: ${err.message}`)
      this.clients.delete(full)
    })
    ws.on('message', () => {
      // Clients only receive; any stray message is answered with a hint.
      try {
        ws.send(JSON.stringify({ kind: 'error', message: 'receive-only socket' }))
      } catch {
        // ignore
      }
    })
    this.clients.add(full)
    try {
      ws.send(JSON.stringify({ kind: 'hello', userId: full.userId, tenantId: full.tenantId }))
    } catch {
      // ignore
    }
    this.logger.log(`client connected userId=${full.userId} role=${full.role} tenantId=${full.tenantId}`)
  }

  /** Forward one telephony event to clients in the event's tenant. */
  private broadcast(event: TelephonyEvent): void {
    if (this.clients.size === 0) return
    let payload: string
    try {
      payload = JSON.stringify(event)
    } catch {
      return
    }
    let sent = 0
    for (const client of this.clients) {
      // Platform view (superadmin, tenant null) sees everything.
      if (client.tenantId !== null && client.tenantId !== event.tenantId) continue
      try {
        client.ws.send(payload)
        sent++
      } catch (err) {
        this.logger.warn(`broadcast send failed readyState=${client.ws.readyState}: ${(err as Error).message}`)
        this.clients.delete(client)
      }
    }
    this.logger.log(`broadcast ${event.kind} tenant=${event.tenantId} → ${sent}/${this.clients.size} clients`)
  }
}
