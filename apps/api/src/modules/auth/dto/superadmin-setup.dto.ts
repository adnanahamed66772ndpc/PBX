import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /auth/superadmin/setup — one-time superadmin provisioning. */
export class SuperadminSetupDto {
  @ApiProperty({ example: 'superadmin@pbx.com', description: 'Superadmin email' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 'S3cure-P@ss!', minLength: 8, description: 'Superadmin password' })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty({ example: 'Platform Admin', description: 'Display name' })
  @IsString()
  @MaxLength(255)
  fullName!: string
}
