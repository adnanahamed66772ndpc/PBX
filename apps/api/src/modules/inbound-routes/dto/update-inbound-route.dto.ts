import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /inbound-routes/:id — every field is optional. */
export class UpdateInboundRouteDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null

  @ApiProperty({ example: 'queue:sales', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  destination?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number
}
