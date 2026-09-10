import { Module } from '@nestjs/common'
import { InboundRoutesController } from './inbound-routes.controller'
import { InboundRoutesService } from './inbound-routes.service'

@Module({
  controllers: [InboundRoutesController],
  providers: [InboundRoutesService],
  exports: [InboundRoutesService],
})
export class InboundRoutesModule {}
