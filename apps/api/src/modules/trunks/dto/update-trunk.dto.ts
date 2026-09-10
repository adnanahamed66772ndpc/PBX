import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsBoolean,
  Matches,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /trunks/:id — every field is optional. */
export class UpdateSipTrunkDto {
  @ApiProperty({ example: 'Carrier One', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string

  @ApiProperty({ example: 'sip.carrier.com', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string

  @ApiProperty({ example: 5060, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number

  @ApiProperty({ example: 'tls', required: false, enum: ['udp', 'tcp', 'tls'] })
  @IsOptional()
  @IsString()
  @Matches(/^(udp|tcp|tls)$/, { message: 'transport must be udp, tcp, or tls' })
  transport?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
