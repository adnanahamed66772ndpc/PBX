import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /inbound-routes — define how inbound calls are routed. */
export class CreateInboundRouteDto {
  @ApiProperty({ example: 'Main route' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'Routes the main DID to the sales IVR', required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ example: 'ivr:main', description: 'Destination token, e.g. ivr:main, queue:sales, ext:1001' })
  @IsString()
  @MaxLength(255)
  destination!: string

  @ApiProperty({ example: 10, required: false, description: 'Lower priority is evaluated first' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number
}
