import { IsString, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /tenants and PATCH /tenants/:id payload. */
export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Telecom' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string

  @ApiProperty({ example: 'pbx.acme.com', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string

  @ApiProperty({ example: 'pro', required: false, description: 'free | pro | enterprise' })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
