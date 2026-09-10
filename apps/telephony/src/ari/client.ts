/**
 * ARI client wrapper.
 *
 * Connects to the Asterisk REST Interface over HTTP + WebSocket using only
 * platform primitives: global `fetch` for the REST calls and the global
 * `WebSocket` (provided by undici/Node ≥ 22) for the stasis event stream.
 * No third-party ARI library is required, so the service boots without
 * installing extra runtime deps beyond @pbx/common and @pbx/db.
 *
 * REST endpoints used (all under ${ARI_URL}/ari):
 *   GET  /events?app=${ARI_APP}                     → WebSocket upgrade (event stream)
 *   POST /channels                                   → originate / create channel
 *   POST /channels/{id}/continue                     → resume dialplan execution
 *   DELETE /channels/{id}                            → hangup channel
 *   POST /channels/{id}/answer                       → answer a ringing channel
 *   POST /channels/{id}/play                         → play media on a channel
 *   POST /bridges                                    → create a bridge
 *   POST /bridges/{id}/addChannel                    → add channels to a bridge
 *   DELETE /bridges/{id}                             → destroy a bridge
 *
 * Authentication is HTTP Basic with ARI_USER / ARI_PASSWORD. The same basic
 * auth is sent as a query-param-free Authorization header on the WebSocket
 * subprotocol upgrade.
 */
import { EventEmitter } from 'node:events'
import type { AriBridge, AriChannel, AriEvent, OriginateParams, OriginateResult } from './types.js'
import { createLogger } from '@pbx/common'

const log = createLogger('ari')

export interface AriClientOptions {
  /** Base URL, e.g. http://asterisk:8088 */
  url: string
  user: string
  password: string
  /** Stasis application name. */
  app: string
}

export class AriClient extends EventEmitter {
  private readonly url: string
  private readonly app: string
  private readonly authHeader: string
  private ws: WebSocket | null = null
  private closed = false
  /** Backoff for reconnect attempts. */
  private reconnectDelayMs = 1_000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(opts: AriClientOptions) {
    super()
    this.url = opts.url.replace(/\/+$/, '')
    this.app = opts.app
    this.authHeader =
      'Basic ' + Buffer.from(`${opts.user}:${opts.password}`).toString('base64')
  }

  // ── lifecycle ────────────────────────────────────────────────────────

  /** Open the WebSocket event stream; reconnects automatically on close. */
  connect(): Promise<void> {
    this.closed = false
    return this.openWebSocket()
  }

  /** Permanently stop the client and stop reconnecting. */
  close(): void {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
  }

  // ── event stream ─────────────────────────────────────────────────────

  /**
   * Build the WebSocket URL from the configured HTTP base.
   * http://host:8088 → ws://host:8088/ari/events?app=…&api_password is NOT
   * used; we rely on the Basic-Auth header carried on the WS handshake, which
   * Asterisk's res_http_websocket accepts when http.conf enables auth.
   */
  private wsUrl(): string {
    const http = this.url
    const ws = http.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    const params = new URLSearchParams({ app: this.app })
    return `${ws}/ari/events?${params.toString()}`
  }

  private openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.closed) return resolve()
      // Node ≥ 22 ships a global WebSocket (undici) whose constructor accepts
      // an options object with `headers` for the upgrade handshake. We attach
      // Basic auth so res_ari authorises the subscription.
      const ws = new WebSocket(this.wsUrl(), {
        headers: { Authorization: this.authHeader },
      } as any)
      this.ws = ws

      ws.addEventListener('open', () => {
        log.info({ app: this.app }, 'ARI websocket connected')
        this.reconnectDelayMs = 1_000
        this.emit('connected')
        resolve()
      })

      ws.addEventListener('message', (ev: MessageEvent) => {
        this.handleMessage(ev.data)
      })

      ws.addEventListener('error', (ev: Event) => {
        log.error({ err: ev }, 'ARI websocket error')
        // The close handler below owns reconnect; surface + reject first connect.
        reject(new Error('ARI websocket error'))
      })

      ws.addEventListener('close', (ev: CloseEvent) => {
        log.warn({ code: ev.code, reason: ev.reason }, 'ARI websocket closed')
        this.emit('disconnected')
        this.ws = null
        this.scheduleReconnect()
      })
    })
  }

  private scheduleReconnect(): void {
    if (this.closed) return
    if (this.reconnectTimer) return
    const delay = this.reconnectDelayMs
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30_000)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      log.info({ delay }, 'ARI reconnecting')
      this.openWebSocket().catch(() => {
        /* error already logged; next close will reschedule */
      })
    }, delay)
  }

  private handleMessage(data: unknown): void {
    let evt: AriEvent
    try {
      const raw = typeof data === 'string' ? data : String(data)
      evt = JSON.parse(raw) as AriEvent
    } catch (err) {
      log.error({ err }, 'ARI event parse failed')
      return
    }
    if (!evt || !evt.type) return
    log.debug({ type: evt.type }, 'ARI event')
    this.emit('event', evt)
    this.emit(evt.type, evt)
  }

  // ── REST helpers ─────────────────────────────────────────────────────

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const target = `${this.url}/ari${path}`
    const init: RequestInit = {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
    }
    if (body !== undefined) init.body = JSON.stringify(body)

    const res = await fetch(target, init)
    if (res.status === 204) return undefined as T
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new AriHttpError(res.status, method, path, text)
    }
    // Some ARI calls (e.g. DELETE) return empty body on success.
    const ctype = res.headers.get('content-type') ?? ''
    if (!ctype.includes('application/json')) return undefined as T
    return (await res.json()) as T
  }

  // ── channel operations ───────────────────────────────────────────────

  /**
   * Originate a call. Maps to POST /channels.
   * `endpoint` is a PJSIP dial string, e.g. `PJSIP/1001` or `PJSIP/trunk-name/sip:number@host`.
   */
  async originate(params: OriginateParams): Promise<OriginateResult> {
    const query = new URLSearchParams()
    if (params.extension) query.set('extension', params.extension)
    if (params.context) query.set('context', params.context)
    if (params.priority != null) query.set('priority', String(params.priority))
    if (params.label) query.set('label', params.label)
    if (params.app) query.set('app', params.app)
    else if (this.app) query.set('app', this.app)
    if (params.appArgs?.length) query.set('appArgs', params.appArgs.join(','))
    if (params.callerId) query.set('callerId', params.callerId)
    if (params.timeout != null) query.set('timeout', String(params.timeout))
    if (params.variables) {
      query.set('variables', JSON.stringify(params.variables))
    }
    const ch = await this.request<AriChannel>(
      'POST',
      `/channels?endpoint=${encodeURIComponent(params.endpoint)}&${query.toString()}`,
    )
    return { id: ch.id, name: ch.name }
  }

  /** Hangup a channel: DELETE /channels/{id}. */
  async hangup(channelId: string): Promise<void> {
    await this.request<void>('DELETE', `/channels/${encodeURIComponent(channelId)}`)
  }

  /** Answer a ringing channel: POST /channels/{id}/answer. */
  async answer(channelId: string): Promise<void> {
    await this.request<void>('POST', `/channels/${encodeURIComponent(channelId)}/answer`)
  }

  /**
   * Resume dialplan execution on a channel parked in Stasis.
   * POST /channels/{id}/continue — used after an IVR routes to an extension.
   */
  async continueChannel(channelId: string, context?: string, exten?: string, priority = 1): Promise<void> {
    const query = new URLSearchParams()
    if (context) query.set('context', context)
    if (exten) query.set('extension', exten)
    query.set('priority', String(priority))
    await this.request<void>(
      'POST',
      `/channels/${encodeURIComponent(channelId)}/continue?${query.toString()}`,
    )
  }

  /**
   * Play media on a channel: POST /channels/{id}/play.
   * `media` is an ARI media URI, e.g. `sound:hello-world` or `tts:Welcome`.
   * Returns the playback id so callers can wait for PlaybackFinished.
   */
  async play(channelId: string, media: string): Promise<string> {
    const query = new URLSearchParams({ media })
    const playback = await this.request<{ id: string }>(
      'POST',
      `/channels/${encodeURIComponent(channelId)}/play?${query.toString()}`,
    )
    return playback.id
  }

  // ── bridge operations ────────────────────────────────────────────────

  /** Create a mixing bridge: POST /bridges. */
  async createBridge(type = 'mixing', name?: string): Promise<AriBridge> {
    const query = new URLSearchParams({ type })
    if (name) query.set('name', name)
    return this.request<AriBridge>('POST', `/bridges?${query.toString()}`)
  }

  /** Add channels to a bridge: POST /bridges/{id}/addChannel. */
  async addChannelsToBridge(bridgeId: string, ...channels: string[]): Promise<void> {
    if (channels.length === 0) return
    const query = new URLSearchParams({ channel: channels.join(',') })
    await this.request<void>(
      'POST',
      `/bridges/${encodeURIComponent(bridgeId)}/addChannel?${query.toString()}`,
    )
  }

  /**
   * Convenience: create a mixing bridge and add the given channels to it.
   * Channels already Up will start hearing each other immediately.
   */
  async bridge(...channels: string[]): Promise<AriBridge> {
    const br = await this.createBridge('mixing')
    await this.addChannelsToBridge(br.id, ...channels)
    return br
  }

  /** Destroy a bridge: DELETE /bridges/{id}. */
  async destroyBridge(bridgeId: string): Promise<void> {
    await this.request<void>('DELETE', `/bridges/${encodeURIComponent(bridgeId)}`)
  }
}

export class AriHttpError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`ARI ${method} ${path} → ${status}: ${body.slice(0, 200)}`)
    this.name = 'AriHttpError'
  }
}
