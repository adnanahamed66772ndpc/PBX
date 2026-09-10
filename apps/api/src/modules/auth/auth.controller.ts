import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService, type AuthTokenPair, type SafeUser } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { TwoFactorDto } from './dto/two-factor.dto'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * Authentication endpoints.
 *
 * register/login/refresh are @Public() so the global JwtAuthGuard lets them
 * through without a token. 2fa/verify and me are protected by the global
 * JwtAuthGuard (no @Public), so request.user is populated for @CurrentUser().
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Self-service tenant + owner provisioning' })
  @ApiResponse({ status: 201, description: 'Tenant and owner created; token pair issued.' })
  register(@Body() dto: RegisterDto): Promise<AuthTokenPair & { user: SafeUser }> {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Email + password login' })
  @ApiResponse({ status: 200, description: 'Access + refresh token pair.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  login(@Body() dto: LoginDto): Promise<AuthTokenPair & { user: SafeUser }> {
    return this.authService.login(dto)
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new pair (rotation)' })
  @ApiResponse({ status: 200, description: 'New access + refresh token pair.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
  refresh(@Body('refreshToken') refreshToken: string): Promise<AuthTokenPair> {
    return this.authService.refresh(refreshToken)
  }

  @Post('2fa/verify')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify a TOTP code (stub implementation)' })
  @ApiResponse({ status: 200, description: '2FA verification result.' })
  verifyTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorDto,
  ): Promise<{ verified: boolean }> {
    return this.authService.verifyTwoFactor(user.id, dto.code)
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Public user profile.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.me(user.id)
  }
}
