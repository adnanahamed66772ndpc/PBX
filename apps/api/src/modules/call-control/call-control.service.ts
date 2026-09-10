import { Injectable, Logger } from '@nestjs/common'
import { AppError } from '@pbx/common'

/**
 * Contract for the telephony control surface.
 *
 * The real implementation lives in apps/telephony and talks to Asterisk ARI.
 * This interface is declared in the API so controllers depend on an abstraction
 * and the ARI wiring can be swapped/mocked (e.g. in tests or when telephony is
 * scaled out). A {@link DefaultCallControlService} stub is provided so the API
 * boots and documents the integration without a running Asterisk.
 */
export interface CallControlService {
  /** Originate a call from `fromExt` to `to` for the given tenant. */
  originate(tenantId: number, fromExt: string, to: string): Promise<{ callId: string }>
  /** Hang up an active channel. */
  hangup(channelId: string): Promise<void>
}

/**
 * Default stub implementation.
 *
 * Behavior:
 *  - If `ARI_URL` is configured and a global `fetch` is available, it issues a
 *    POST to `${ARI_URL}/ari/channels` (Asterisk ARI REST) to originate a real
 *    channel. Credentials/app/channel params would be filled in by the real
 *    telephony service; this documents the integration point.
 *  - Otherwise it logs the request and throws a 501 'not_implemented' error so
 *    callers get an honest signal that telephony is not wired up.
 */
@Injectable()
export class DefaultCallControlService implements CallControlService {
  private readonly logger = new Logger(DefaultCallControlService.name)
  private readonly ariUrl: string

  constructor() {
    this.ariUrl = (process.env.ARI_URL ?? '').replace(/\/$/, '')
  }

  async originate(tenantId: number, fromExt: string, to: string): Promise<{ callId: string }> {
    this.logger.log(`originate tenant=${tenantId} from=${fromExt} to=${to}`)

    // If ARI is configured and fetch exists, attempt a real originate.
    if (this.ariUrl && typeof fetch === 'function') {
      try {
        const url =
          `${this.ariUrl}/ari/channels?endpoint=PJSIP/${encodeURIComponent(fromExt)}` +
          `&extension=${encodeURIComponent(to)}&context=default&app=pbx&appArgs=${tenantId}`
        const res = await fetch(url, { method: 'POST' })
        if (!res.ok) {
          throw new AppError('telephony_error', `ARI originate failed: ${res.status} ${res.statusText}`, 502)
        }
        const body = (await res.json()) as { id?: string }
        if (!body.id) {
          throw new AppError('telephony_error', 'ARI originate returned no channel id', 502)
        }
        return { callId: body.id }
      } catch (err) {
        if (err instanceof AppError) throw err
        throw new AppError('telephony_error', `ARI originate error: ${(err as Error).message}`, 502)
      }
    }

    // No telephony backend configured → honest 501.
    this.logger.warn('Call origination not implemented — ARI_URL unset or fetch unavailable.')
    throw new AppError(
      'not_implemented',
      'Call origination is not configured (set ARI_URL or wire apps/telephony).',
      501,
    )
  }

  async hangup(channelId: string): Promise<void> {
    this.logger.log(`hangup channel=${channelId}`)

    if (this.ariUrl && typeof fetch === 'function') {
      try {
        const res = await fetch(`${this.ariUrl}/ari/channels/${encodeURIComponent(channelId)}`, {
          method: 'DELETE',
        })
        if (!res.ok && res.status !== 404) {
          throw new AppError('telephony_error', `ARI hangup failed: ${res.status} ${res.statusText}`, 502)
        }
        return
      } catch (err) {
        if (err instanceof AppError) throw err
        throw new AppError('telephony_error', `ARI hangup error: ${(err as Error).message}`, 502)
      }
    }

    throw new AppError(
      'not_implemented',
      'Call hangup is not configured (set ARI_URL or wire apps/telephony).',
      501,
    )
  }
}
