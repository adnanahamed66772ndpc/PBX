import { IsString, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /tenants/:id — every field is optional. */
export class UpdateTenantDto {
  @ApiProperty({ example: 'Acme Telecom', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string

  @ApiProperty({ example: 'pbx.acme.com', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string

  @ApiProperty({ example: 'enterprise', required: false })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
