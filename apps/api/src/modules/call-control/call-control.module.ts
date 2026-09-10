import { Module } from '@nestjs/common'
import { CallControlController } from './call-control.controller'
import { DefaultCallControlService } from './call-control.service'

/**
 * Token for the CallControlService interface, used as a DI provider key so
 * the interface can be swapped (real ARI impl vs stub) without touching
 * call sites.
 */
export const CALL_CONTROL_SERVICE = Symbol('CALL_CONTROL_SERVICE')

@Module({
  controllers: [CallControlController],
  providers: [{ provide: CALL_CONTROL_SERVICE, useClass: DefaultCallControlService }],
  exports: [CALL_CONTROL_SERVICE],
})
export class CallControlModule {}
