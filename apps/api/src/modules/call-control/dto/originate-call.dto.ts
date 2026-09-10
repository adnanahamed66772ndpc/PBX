import { IsString, IsOptional, Matches, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /calls/originate — request a new outbound call leg. */
export class OriginateCallDto {
  @ApiProperty({ example: '1001', description: 'Calling extension within the tenant' })
  @IsString()
  @Matches(/^\d{2,10}$/, { message: 'fromExt must be an extension number' })
  fromExt!: string

  @ApiProperty({ example: '+18005551234', description: 'Destination — extension or E.164 number' })
  @IsString()
  @MaxLength(32)
  to!: string

  @ApiProperty({ required: false, description: 'Optional caller id override' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  callerId?: string
}
