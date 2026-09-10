import { Module } from '@nestjs/common'
import { EventsService } from './events.service'

/**
 * Event publishing module.
 *
 * Provides {@link EventsService} globally so any module that needs to emit a
 * {@link TelephonyEvent} can inject it. The service degrades to a no-op when
 * NATS is unavailable, so importing this module never breaks boot.
 */
@Module({
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
