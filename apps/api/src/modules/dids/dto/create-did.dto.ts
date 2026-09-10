import { IsString, IsOptional, IsBoolean, Matches, IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /dids — claim a phone number for the tenant. */
export class CreateDidDto {
  @ApiProperty({ example: '+18005551234', description: 'E.164 phone number' })
  @IsString()
  @Matches(/^\+?\d{6,15}$/, { message: 'number must be a plausible E.164 phone number' })
  number!: string

  @ApiProperty({ example: 7, required: false, description: 'Inbound route to assign (must belong to the same tenant)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  inbound_route_id?: number | null

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean
}
