import { Body, Controller, Delete, Get, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { AuthService, type AuthTokenPair, type SafeUser } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { TwoFactorDto } from './dto/two-factor.dto'
import { SwitchTenantDto } from './dto/switch-tenant.dto'
import { SuperadminSetupDto } from './dto/superadmin-setup.dto'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * Authentication endpoints.
 *
 * register/login/refresh are @Public() so the global JwtAuthGuard lets them
 * through without a token. 2fa/setup, 2fa/verify, 2fa, and me are protected
 * by the global JwtAuthGuard (no @Public), so request.user is populated for
 * @CurrentUser().
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

  @Post('2fa/setup')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate a new TOTP secret and return an otpauth:// URI for QR enrolment' })
  @ApiResponse({ status: 201, description: 'Secret + otpauth URI for QR code rendering.' })
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser): Promise<{
    secret: string
    otpauthUrl: string
  }> {
    return this.authService.setupTwoFactor(user.id)
  }

  @Post('2fa/verify')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify a 6-digit TOTP code (RFC 6238)' })
  @ApiResponse({ status: 200, description: '2FA verification result.' })
  @ApiResponse({ status: 409, description: '2FA not configured for this account.' })
  verifyTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorDto,
  ): Promise<{ verified: boolean }> {
    return this.authService.verifyTwoFactor(user.id, dto.code)
  }

  @Delete('2fa')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Disable 2FA — clears the stored TOTP secret' })
  @ApiResponse({ status: 200, description: '2FA disabled.' })
  @ApiResponse({ status: 409, description: '2FA not configured for this account.' })
  disableTwoFactor(@CurrentUser() user: AuthenticatedUser): Promise<{ disabled: true }> {
    return this.authService.disableTwoFactor(user.id)
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Public user profile.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SafeUser> {
    return this.authService.me(user.id, user.tenantId)
  }

  @Post('switch-tenant')
  @ApiBearerAuth('access-token')
  @Roles('superadmin')
  @ApiOperation({ summary: 'Switch superadmin active tenant — issues a new token pair scoped to the target tenant' })
  @ApiResponse({ status: 200, description: 'New token pair scoped to the target tenant.' })
  @ApiResponse({ status: 403, description: 'Only superadmin can switch tenants.' })
  switchTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchTenantDto,
  ): Promise<AuthTokenPair & { user: SafeUser }> {
    return this.authService.switchTenant(user.id, dto.tenantId)
  }

  @Public()
  @Post('superadmin/setup')
  @ApiOperation({ summary: 'One-time superadmin provisioning (refuses if one already exists)' })
  @ApiResponse({ status: 201, description: 'Superadmin created; token pair issued.' })
  @ApiResponse({ status: 409, description: 'A superadmin already exists.' })
  setupSuperAdmin(@Body() dto: SuperadminSetupDto): Promise<AuthTokenPair & { user: SafeUser }> {
    return this.authService.setupSuperAdmin(dto.email, dto.password, dto.fullName)
  }
}
