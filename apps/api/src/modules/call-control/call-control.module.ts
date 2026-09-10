import { Module } from '@nestjs/common'
import { CallControlController } from './call-control.controller'
import { DefaultCallControlService } from './call-control.service'

/**
 * Call control module. Provides DefaultCallControlService directly — to swap
 * in a real ARI implementation, replace the provider's useClass.
 */
@Module({
  controllers: [CallControlController],
  providers: [DefaultCallControlService],
  exports: [DefaultCallControlService],
})
export class CallControlModule {}
