import { Module } from '@nestjs/common'
import { CallControlController } from './call-control.controller'
import { CallControlService, DefaultCallControlService } from './call-control.service'

/**
 * Call control module.
 *
 * Binds the {@link CallControlService} interface to the
 * {@link DefaultCallControlService} stub. To wire real telephony, replace the
 * `useClass` with a provider that delegates to apps/telephony's ARI client
 * (e.g. via an RPC call or HTTP). Controllers depend on the interface token so
 * the implementation can change without touching call sites.
 */
@Module({
  controllers: [CallControlController],
  providers: [{ provide: CallControlService, useClass: DefaultCallControlService }],
  exports: [CallControlService],
})
export class CallControlModule {}
