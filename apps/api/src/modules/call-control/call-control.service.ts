import { Injectable, Logger } from '@nestjs/common'
import { AppError } from '@pbx/common'

/**
 * Contract for the telephony control surface.
 *
 * The real implementation lives in apps/telephony (which owns the Asterisk
 * ARI connection). This service calls it over HTTP with a shared-secret
 * header, so the API never needs direct ARI access and telephony can be
 * scaled/hardened independently.
 */
export interface CallControlService {
  /** Originate a call from `fromExt` to `to` for the given tenant. */
  originate(tenantId: number, fromExt: string, to: string): Promise<{ callId: string }>
  /** Hang up an active channel. */
  hangup(channelId: string): Promise<void>
}

/**
 * HTTP client for apps/telephony's control API:
 *   POST /originate { fromExt, to, tenantId } → 201 { channelId }
 *   POST /hangup    { channelId }             → 200 { ok: true }
 *
 * Every mutating request carries `X-Telephony-Token` (TELEPHONY_TOKEN env),
 * which the telephony service verifies with a constant-time comparison.
 */
@Injectable()
export class DefaultCallControlService implements CallControlService {
  private readonly logger = new Logger(DefaultCallControlService.name)
  private readonly baseUrl: string
  private readonly token: string

  constructor() {
    this.baseUrl = (process.env.TELEPHONY_URL ?? 'http://127.0.0.1:5000').replace(/\/$/, '')
    this.token = process.env.TELEPHONY_TOKEN ?? ''
  }

  async originate(tenantId: number, fromExt: string, to: string): Promise<{ callId: string }> {
    this.logger.log(`originate tenant=${tenantId} from=${fromExt} to=${to} via telephony service`)
    const body = await this.request<{ channelId?: string }>(
      '/originate',
      JSON.stringify({ fromExt, to, tenantId }),
    )
    if (!body.channelId) {
      throw new AppError('telephony_error', 'Telephony originate returned no channel id', 502)
    }
    return { callId: body.channelId }
  }

  async hangup(channelId: string): Promise<void> {
    this.logger.log(`hangup channel=${channelId} via telephony service`)
    await this.request('/hangup', JSON.stringify({ channelId }))
  }

  /** POST JSON to the telephony control API with shared-secret auth. */
  private async request<T>(path: string, body: string): Promise<T> {
    if (!this.token) {
      throw new AppError(
        'not_implemented',
        'Call control is not configured (set TELEPHONY_TOKEN for the telephony service).',
        501,
      )
    }
    if (typeof fetch !== 'function') {
      throw new AppError('telephony_error', 'fetch unavailable in this runtime', 502)
    }
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telephony-token': this.token,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })
    } catch (err) {
      throw new AppError(
        'telephony_error',
        `Telephony service unreachable: ${(err as Error).message}`,
        502,
      )
    }
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      // Surface the telephony service's error code when parseable.
      let code = 'telephony_error'
      let message = `Telephony call-control failed: ${res.status} ${res.statusText}`
      try {
        const parsed = JSON.parse(text) as { code?: string; error?: string }
        if (parsed.code) code = parsed.code
        if (parsed.error) message = parsed.error
      } catch {
        // keep defaults
      }
      throw new AppError(code, message, res.status === 501 ? 501 : 502)
    }
    if (!text) return {} as T
    return JSON.parse(text) as T
  }
}
