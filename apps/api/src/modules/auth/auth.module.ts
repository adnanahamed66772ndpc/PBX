import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './strategies/jwt.strategy'
import { RefreshStrategy } from './strategies/refresh.strategy'

/**
 * Authentication module.
 *
 * Registers the 'jwt' and 'jwt-refresh' passport strategies and a JwtService
 * configured from the JWT_SECRET / JWT_EXPIRES_IN env vars. The refresh
 * strategy is registered here so the symmetric signing key is available even
 * though refresh handling currently lives in AuthService.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
