import { IsInt, IsOptional, IsBoolean, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /queues/:id/members — add an extension as a queue member. */
export class AddQueueMemberDto {
  @ApiProperty({ example: 12, description: 'Extension id within the tenant' })
  @IsInt()
  @Min(1)
  extension_id!: number

  @ApiProperty({ example: 1, required: false, description: 'Priority / penalty; lower rings first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  penalty?: number

  @ApiProperty({ example: false, required: false, description: 'Pause this member' })
  @IsOptional()
  @IsBoolean()
  paused?: boolean
}
