import { IsString, IsOptional, MaxLength, IsBoolean, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /extensions/:id — every field is optional. */
export class UpdateExtensionDto {
  @ApiProperty({ example: 42, required: false, nullable: true, description: 'Reassign owning user' })
  @IsOptional()
  @IsInt()
  @Min(1)
  user_id?: number | null

  @ApiProperty({ example: 'Jane Q. Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  caller_id?: string

  @ApiProperty({ example: 'sales', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  context?: string

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  webrtc?: boolean
}
