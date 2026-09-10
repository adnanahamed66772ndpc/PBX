import { IsString, IsOptional, IsBoolean, Matches, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** PATCH /dids/:id — every field is optional. */
export class UpdateDidDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'number must be a plausible E.164 phone number' })
  number?: string

  @ApiProperty({ example: 7, required: false, nullable: true, description: 'Assign or clear the inbound route' })
  @IsOptional()
  @IsInt()
  @Min(1)
  inbound_route_id?: number | null

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
