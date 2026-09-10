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

/** POST /trunks — register an outbound SIP trunk. */
export class CreateSipTrunkDto {
  @ApiProperty({ example: 'Carrier One' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string

  @ApiProperty({ example: 'sip.carrier.com' })
  @IsString()
  @MaxLength(255)
  hostname!: string

  @ApiProperty({ example: 5060, minimum: 1, maximum: 65535, required: false })
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

  @ApiProperty({ example: 'trunkuser', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  username?: string

  @ApiProperty({ example: 'trunkpass', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  password?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
