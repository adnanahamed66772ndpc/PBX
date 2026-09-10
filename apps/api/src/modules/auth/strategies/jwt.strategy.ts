import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { getDb } from '@pbx/db'
import type { User } from '@pbx/db'
import type { JwtPayload } from '../principal'
import type { AuthenticatedUser } from '../../../common/tenancy/tenant-context'

/**
 * JWT bearer strategy for access tokens.
 *
 * Verifies the signature using JWT_SECRET (passport-jwt handles verification
 * via `secretOrKey`), then loads the user from the database to confirm the
 * account still exists and is active. The validated principal (shaped as
 * {@link AuthenticatedUser}) is attached to request.user, from which the
 * tenancy interceptor and RolesGuard read the tenant id / role.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-insecure-secret',
    })
  }

  /** Called by passport after token verification; return value → request.user. */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const db = getDb()
    const { rows } = await db.query<User>(
      'SELECT id, tenant_id, email, role, active FROM users WHERE id = $1',
      [payload.sub],
    )
    const user = rows[0]
    if (!user || !user.active) {
      throw new UnauthorizedException('account inactive or not found')
    }
    return {
      id: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
    }
  }
}
