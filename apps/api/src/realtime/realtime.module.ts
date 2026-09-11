import { Module } from '@nestjs/common'
import { RealtimeGateway } from './realtime.gateway'
import { AuthModule } from '../modules/auth/auth.module'
import { EventsModule } from '../modules/events/events.module'

/**
 * Realtime event relay. Imports AuthModule for JwtService (token verification
 * on upgrade) and EventsModule for the NATS event stream. The gateway hooks
 * the HTTP server's upgrade event — no extra listener is needed.
 */
@Module({
  imports: [AuthModule, EventsModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
