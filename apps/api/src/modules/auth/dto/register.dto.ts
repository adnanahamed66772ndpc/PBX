import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * POST /auth/register — self-service tenant provisioning.
 *
 * Creates a new tenant and its first 'owner' user in a single transaction.
 * The owner then invites the rest of their team through the /users endpoints.
 */
export class RegisterDto {
  @ApiProperty({ example: 'Acme Telecom', description: 'New tenant / organization name' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  tenantName!: string

  @ApiProperty({ example: 'pbx.acme.com', required: false, description: 'Optional tenant domain' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  domain?: string

  @ApiProperty({ example: 'free', required: false, description: 'Subscription plan' })
  @IsOptional()
  @IsString()
  plan?: string

  @ApiProperty({ example: 'owner@example.com', description: 'Owner account email' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'Ada Owner', required: false, description: 'Owner display name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string

  @ApiProperty({ example: 's3cret-pass', minLength: 8, description: 'Owner password' })
  @IsString()
  @MinLength(8)
  password!: string
}
