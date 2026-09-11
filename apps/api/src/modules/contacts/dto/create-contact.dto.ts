import { IsString, IsOptional, IsEmail, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateContactDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string

  @ApiProperty({ example: 'john@company.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  phone!: string

  @ApiProperty({ example: '1001', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  extension?: string

  @ApiProperty({ example: 'Sales', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string
}
