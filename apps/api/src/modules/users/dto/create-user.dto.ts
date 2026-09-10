import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import type { Role, Presence } from '@pbx/db'

/** POST /users — create a user within the current tenant. */
export class CreateUserDto {
  @ApiProperty({ example: 'agent@acme.com' })
  @IsEmail()
  email!: string

  @ApiProperty({ example: 's3cret-pass', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string

  @ApiProperty({ example: 'agent', required: false, enum: ['owner', 'admin', 'manager', 'agent', 'user'] })
  @IsOptional()
  @IsString()
  role?: Role

  @ApiProperty({ example: 'available', required: false, enum: ['available', 'away', 'dnd', 'offline'] })
  @IsOptional()
  @IsString()
  presence?: Presence

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
