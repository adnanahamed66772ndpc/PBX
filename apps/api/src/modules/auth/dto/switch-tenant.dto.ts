import { IsInt, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/** POST /auth/switch-tenant — superadmin switches active tenant. */
export class SwitchTenantDto {
  @ApiProperty({ example: 1, description: 'Target tenant id to scope the new JWT to' })
  @IsInt()
  @Min(1)
  tenantId!: number
}
