import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { subjectFor, type TelephonyEvent } from '@pbx/common'

/**
 * Minimal typed shape of a NATS publish client. Defined locally (rather than
 * importing the real `nats` types) so the module compiles and boots even when
 * the `nats` package is absent from the runtime.
 */
export interface NatsPublisher {
  publish(subject: string, data: Uint8Array): void
  close(): Promise<void>
}

/**
 * NATS event publisher.
 *
 * The telephony service (apps/telephony) is the authoritative producer of
 * {@link TelephonyEvent}s, but the control plane also publishes some events
 * (e.g. config changes mirrored as presence/queue updates). This service:
 *
 *  - attempts to lazily connect to NATS on module init;
 *  - if the `nats` package or NATS_URL is unavailable, logs a warning and
 *    degrades to a no-op so the API still boots without a broker;
 *  - publishes each event to the subject derived from {@link subjectFor}.
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name)
  private client: NatsPublisher | null = null
  private readonly natsUrl: string

  constructor() {
    this.natsUrl = process.env.NATS_URL ?? ''
  }

  async onModuleInit(): Promise<void> {
    await this.connect()
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close()
      } catch (err) {
        this.logger.warn(`Error closing NATS connection: ${(err as Error).message}`)
      }
      this.client = null
    }
  }

  /**
   * Publish a {@link TelephonyEvent} to its NATS subject. No-ops (with a
   * warning) when NATS is not connected, so callers can always invoke this
   * without guarding the broker state.
   */
  publish(event: TelephonyEvent): void {
    if (!this.client) {
      this.logger.debug(`NATS unavailable — dropping event ${event.kind} for tenant ${event.tenantId}`)
      return
    }
    const [category, name] = event.kind.split('.')
    if (!category || !name) {
      this.logger.warn(`Cannot derive subject from event kind "${event.kind}"`)
      return
    }
    const subject = subjectFor(event.tenantId, category, name)
    const payload = Buffer.from(JSON.stringify(event))
    try {
      this.client.publish(subject, new Uint8Array(payload))
      this.logger.debug(`Published ${subject}`)
    } catch (err) {
      this.logger.warn(`Failed to publish ${subject}: ${(err as Error).message}`)
    }
  }

  /** True when a live NATS publisher is available. */
  get connected(): boolean {
    return this.client !== null
  }

  /**
   * Subscribe to every telephony event subject (`pbx.<tenant>.<cat>.<name>`)
   * and forward each parsed {@link TelephonyEvent} to `handler`. Used by the
   * realtime WebSocket gateway to relay events to browser clients.
   *
   * Multiple handlers are supported; each subscription is created once.
   * When NATS is unavailable the handler simply never fires — callers must
   * tolerate that (the gateway does: clients just see no events).
   */
  async onEvent(handler: (event: TelephonyEvent, subject: string) => void): Promise<void> {
    this.eventHandlers.push(handler)
    await this.ensureSubscription()
  }

  private async ensureSubscription(): Promise<void> {
    if (!this.client || this.subscribed) return
    if (this.subscribing) return this.subscribing
    this.subscribing = (async () => {
      try {
        const nc = this.client as unknown as {
          subscribe: (
            subject: string,
            opts?: { callback?: (err: unknown, msg: { data: Uint8Array; subject: string }) => void },
          ) => { unsubscribe(): void }
        }
        const decoder = new TextDecoder()
        nc.subscribe('pbx.*.*.*', {
          callback: (err, msg) => {
            if (err || !msg) {
              this.logger.warn(`NATS callback error on ${msg?.subject ?? 'unknown'}`)
              return
            }
            try {
              const evt = JSON.parse(decoder.decode(msg.data)) as TelephonyEvent
              this.logger.log(`NATS event received: ${evt.kind} tenant=${(evt as { tenantId?: number }).tenantId}`)
              for (const handler of this.eventHandlers) handler(evt, msg.subject)
            } catch (err2) {
              this.logger.warn(`Unparseable NATS message on ${msg.subject}`)
            }
          },
        })
        this.subscribed = true
        this.logger.log('Subscribed to pbx.*.*.* event subjects')
      } catch (err) {
        this.logger.warn(`NATS subscribe failed (${(err as Error).message})`)
      } finally {
        this.subscribing = null
      }
    })()
    return this.subscribing
  }

  private subscribed = false
  private subscribing: Promise<void> | null = null
  private eventHandlers: Array<(event: TelephonyEvent, subject: string) => void> = []

  private async connect(): Promise<void> {
    if (!this.natsUrl) {
      this.logger.warn('NATS_URL not set — event publishing disabled (no-op).')
      return
    }
    try {
      // Dynamic import so a missing/unreachable `nats` package at runtime
      // degrades to a no-op rather than crashing boot.
      const nats = (await import('nats')) as unknown as {
        connect: (opts: { servers: string }) => Promise<NatsPublisher>
      }
      const nc = await nats.connect({ servers: this.natsUrl })
      this.client = nc
      this.logger.log(`Connected to NATS at ${this.natsUrl}`)
    } catch (err) {
      this.logger.warn(
        `NATS unavailable (${(err as Error).message}) — event publishing disabled (no-op).`,
      )
      this.client = null
    }
  }
}
