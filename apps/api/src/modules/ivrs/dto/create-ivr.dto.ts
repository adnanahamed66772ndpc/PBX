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

/** A single IVR menu entry: pressing `digit` routes to `destination`. */
export class IvrMenuEntry {
  @ApiProperty({ example: '1', description: 'Digit the caller presses' })
  @IsString()
  @MaxLength(2)
  digit!: string

  @ApiProperty({ example: 'queue:sales', description: 'Destination token' })
  @IsString()
  @MaxLength(255)
  destination!: string
}

/** POST /ivrs — create an IVR menu. `menu` is stored as JSONB. */
export class CreateIvrDto {
  @ApiProperty({ example: 'Main IVR' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string

  @ApiProperty({ example: 'welcome.wav', required: false, description: 'Sound file path or TTS text' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  greeting?: string

  @ApiProperty({ type: 'array', required: false, description: 'Menu entries (JSONB at rest)' })
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMinSize(0)
  @Type(() => IvrMenuEntry)
  menu?: IvrMenuEntry[]

  @ApiProperty({ example: 5, required: false, description: 'Inter-digit timeout in seconds' })
  @IsOptional()
  @IsInt()
  @Min(1)
  timeout?: number
}
