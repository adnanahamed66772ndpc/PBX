import { IsString, IsOptional, MaxLength, IsBoolean, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /extensions — provision a SIP extension within the current tenant. */
export class CreateExtensionDto {
  @ApiProperty({ example: '1001', description: 'Short extension number, unique per tenant' })
  @IsString()
  @Matches(/^\d{2,10}$/, { message: 'ext_number must be 2–10 digits' })
  ext_number!: string

  @ApiProperty({ example: 42, required: false, description: 'Owning user id within the tenant' })
  @IsOptional()
  user_id?: number

  @ApiProperty({ example: 'Jane Doe', required: false, description: 'Outbound caller id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  caller_id?: string

  @ApiProperty({ example: 'default', required: false, description: 'Dialplan context' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  context?: string

  @ApiProperty({ example: true, required: false, description: 'Whether the extension supports WebRTC' })
  @IsOptional()
  @IsBoolean()
  webrtc?: boolean
}
