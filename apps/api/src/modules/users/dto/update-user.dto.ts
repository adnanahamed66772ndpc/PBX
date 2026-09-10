import { IsEmail, IsString, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import type { Role, Presence } from '@pbx/db'

/** PATCH /users/:id — every field is optional. */
export class UpdateUserDto {
  @ApiProperty({ example: 'new@acme.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ example: 'newpass-123', required: false, minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string

  @ApiProperty({ example: 'Jane Q. Doe', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string

  @ApiProperty({ example: 'manager', required: false, enum: ['owner', 'admin', 'manager', 'agent', 'user'] })
  @IsOptional()
  @IsString()
  role?: Role

  @ApiProperty({ example: 'dnd', required: false, enum: ['available', 'away', 'dnd', 'offline'] })
  @IsOptional()
  @IsString()
  presence?: Presence

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
