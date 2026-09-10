import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { IvrMenuEntry } from './create-ivr.dto'

/** PATCH /ivrs/:id — every field is optional. */
export class UpdateIvrDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  greeting?: string | null

  @ApiProperty({ type: 'array', required: false })
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(0)
  @Type(() => IvrMenuEntry)
  menu?: IvrMenuEntry[]

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeout?: number
}
