import { IsString, MinLength, MaxLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

/**
 * POST /auth/2fa/verify — time-based one-time password submission.
 *
 * The backend validates the 6-digit code against the user's `totp_secret`
 * using RFC 6238 TOTP (otplib) with a ±1 time-step window for clock drift.
 */
export class TwoFactorDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, { message: 'code must be exactly 6 digits' })
  code!: string
}
