import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * POST /auth/login credentials.
 */
export class LoginDto {
  @ApiProperty({ example: 'owner@example.com', description: 'Account email' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 's3cret-pass', minLength: 8, description: 'Account password' })
  @IsString()
  @MinLength(8)
  password!: string
}
