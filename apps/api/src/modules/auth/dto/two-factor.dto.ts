import { IsString, MinLength, MaxLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * POST /auth/2fa/verify — time-based one-time password submission.
 *
 * The backend's TOTP verification is currently a stub (simple 6-digit check);
 * the real implementation will validate against the user's totp_secret using
 * an RFC 6238 TOTP library.
 */
export class TwoFactorDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code!: string
}
