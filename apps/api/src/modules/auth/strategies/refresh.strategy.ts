import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { getDb } from '@pbx/db'
import type { RefreshPayload } from '../principal'

/**
 * Refresh-token strategy.
 *
 * A refresh token is a JWT signed with the same secret but carrying a minimal
 * {@link RefreshPayload} (user id + token hash). Validation confirms the
 * token hash is present, unrevoked, and unexpired in the `refresh_tokens`
 * table — which is what makes rotation / revocation possible. The validated
 * payload is attached to request.user so the controller can mint a new access
 * token without re-sending the password.
 */
@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-insecure-secret',
    })
  }

  async validate(payload: RefreshPayload): Promise<{ sub: number; tokenHash: string }> {
    const db = getDb()
    const { rows } = await db.query<{ id: number }>(
      'SELECT id FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()',
      [payload.sub, payload.tokenHash],
    )
    if (rows.length === 0) {
      throw new UnauthorizedException('refresh token invalid or expired')
    }
    return { sub: payload.sub, tokenHash: payload.tokenHash }
  }
}
