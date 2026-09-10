import { Module } from '@nestjs/common'
import { TrunksController } from './trunks.controller'
import { TrunksService } from './trunks.service'

@Module({
  controllers: [TrunksController],
  providers: [TrunksService],
  exports: [TrunksService],
})
export class TrunksModule {}
