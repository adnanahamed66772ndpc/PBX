import { Module } from '@nestjs/common'
import { VoicemailController } from './voicemail.controller'
import { VoicemailService } from './voicemail.service'

@Module({
  controllers: [VoicemailController],
  providers: [VoicemailService],
})
export class VoicemailModule {}
