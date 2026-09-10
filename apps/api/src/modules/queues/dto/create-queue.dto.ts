import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /queues — define a call queue. */
export class CreateQueueDto {
  @ApiProperty({ example: 'Sales' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'ringall', required: false, enum: ['ringall', 'roundrobin', 'leastrecent', 'fewestcalls'] })
  @IsOptional()
  @IsString()
  @Matches(/^(ringall|roundrobin|leastrecent|fewestcalls)$/, { message: 'invalid strategy' })
  strategy?: string

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeout?: number

  @ApiProperty({ example: 5, required: false, description: 'Agent wrap-up time in seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  wrapup_time?: number

  @ApiProperty({ example: 0, required: false, description: 'Max callers waiting; 0 = unlimited' })
  @IsOptional()
  @IsInt()
  @Min(0)
  max_callers?: number
}
