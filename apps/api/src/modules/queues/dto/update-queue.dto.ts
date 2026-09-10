import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /queues/:id — every field is optional. */
export class UpdateQueueDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiProperty({ required: false, enum: ['ringall', 'roundrobin', 'leastrecent', 'fewestcalls'] })
  @IsOptional()
  @IsString()
  @Matches(/^(ringall|roundrobin|leastrecent|fewestcalls)$/, { message: 'invalid strategy' })
  strategy?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeout?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  wrapup_time?: number

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_callers?: number
}
