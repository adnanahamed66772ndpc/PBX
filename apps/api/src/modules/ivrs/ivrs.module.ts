import { Module } from '@nestjs/common'
import { IvrsController } from './ivrs.controller'
import { IvrsService } from './ivrs.service'

@Module({
  controllers: [IvrsController],
  providers: [IvrsService],
  exports: [IvrsService],
})
export class IvrsModule {}
