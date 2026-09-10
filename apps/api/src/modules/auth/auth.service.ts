import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { getDb, tx } from '@pbx/db'
import type { User } from '@pbx/db'
import { AppError, Errors } from '@pbx/common'
import type { JwtPayload, RefreshPayload } from './principal'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'

/**
 * Shape returned by login/register/refresh: an access JWT plus the opaque-ish
 * refresh JWT. The client stores the refresh token securely and submits it to
 * /auth/refresh to obtain a new access token.
 */
export interface AuthTokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

/** Public projection of a user (password / totp secret never exposed). */
export interface SafeUser {
  id: number
  tenantId: number
  email: string
  fullName: string | null
  role: string
  presence: string
  active: boolean
  twoFactorEnabled: boolean
}

const REFRESH_TOKEN_BYTES = 48

/**
 * The shared {@link User} type intentionally omits `password_hash` so the
 * credential column never leaks through typed code paths. This local row type
 * re-adds it for the single query that must read it (login verification).
 */
type UserWithHash = User & { password_hash: string }

/**
 * Authentication core: credential verification, JWT issuance, refresh-token
 * rotation (hashed at rest), TOTP stub, and self-service tenant provisioning.
 *
 * Refresh tokens are stored as a SHA-256 hash in the `refresh_tokens` table so
 * a database leak does not immediately grant access; rotation revokes the
 * consumed token and issues a fresh one.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Self-service registration: creates a new tenant and its owner user inside
   * a single transaction. Returns an auth token pair so the caller is logged
   * in immediately.
   */
  async register(dto: RegisterDto): Promise<AuthTokenPair & { user: SafeUser }> {
    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = await tx(async (client) => {
      // 1. Create the tenant.
      const tenantRes = await client.query<{ id: number }>(
        'INSERT INTO tenants (name, domain, plan) VALUES ($1, $2, $3) RETURNING id',
        [dto.tenantName, dto.domain ?? null, dto.plan ?? 'free'],
      )
      const tenantId = tenantRes.rows[0].id

      // 2. Create the owner user scoped to that tenant.
      const userRes = await client.query<User>(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, role, presence, active)
         VALUES ($1, $2, $3, $4, 'owner', 'available', true)
         RETURNING id, tenant_id, email, full_name, role, presence, active, totp_secret`,
        [tenantId, dto.email, passwordHash, dto.fullName ?? null],
      )
      return userRes.rows[0]
    })

    return this.issueTokensForUser(user)
  }

  /**
   * Email + password login. Throws on unknown email or bad password — both
   * map to the same generic message to avoid user enumeration.
   */
  async login(dto: LoginDto): Promise<AuthTokenPair & { user: SafeUser }> {
    const db = getDb()
    const { rows } = await db.query<UserWithHash>(
      'SELECT id, tenant_id, email, full_name, role, presence, active, password_hash, totp_secret FROM users WHERE email = $1 AND active = true',
      [dto.email],
    )
    const user = rows[0]
    if (!user) {
      throw Errors.unauthorized()
    }
    const ok = await bcrypt.compare(dto.password, user.password_hash)
    if (!ok) {
      throw Errors.unauthorized()
    }
    return this.issueTokensForUser(user)
  }

  /**
   * Exchange a valid refresh token for a new access + refresh pair, revoking
   * the consumed refresh token (rotation). If the presented token has already
   * been revoked, the caller must re-authenticate.
   */
  async refresh(refreshToken: string): Promise<AuthTokenPair> {
    let payload: RefreshPayload
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken)
    } catch {
      throw Errors.unauthorized()
    }

    const tokenHash = hashToken(refreshToken)
    const db = getDb()

    // Confirm the token is live and atomically revoke it.
    const { rows } = await db.query<{ id: number }>(
      `UPDATE refresh_tokens
       SET revoked_at = now()
       WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND expires_at > now()
       RETURNING id`,
      [payload.sub, tokenHash],
    )
    if (rows.length === 0) {
      throw Errors.unauthorized()
    }

    // Load the user to mint a fresh pair.
    const { rows: userRows } = await db.query<User>(
      'SELECT id, tenant_id, email, role, active FROM users WHERE id = $1',
      [payload.sub],
    )
    const user = userRows[0]
    if (!user || !user.active) {
      throw Errors.unauthorized()
    }
    return this.mintPair(user)
  }

  /**
   * TOTP verification stub. The real implementation will derive the expected
   * 6-digit code from the user's totp_secret using RFC 6238. Here we accept any
   * well-formed 6-digit string when a secret is configured, and reject otherwise.
   */
  async verifyTwoFactor(userId: number, code: string): Promise<{ verified: boolean }> {
    const db = getDb()
    const { rows } = await db.query<User>(
      'SELECT totp_secret FROM users WHERE id = $1 AND active = true',
      [userId],
    )
    const user = rows[0]
    if (!user || !user.totp_secret) {
      throw new AppError('two_factor_not_configured', '2FA is not enabled for this account', 409)
    }
    // STUB: accept any 6-digit code. Replace with real TOTP derivation.
    const verified = /^\d{6}$/.test(code)
    this.logger.warn(`TOTP verification is a STUB — accepting any 6-digit code for user ${userId}`)
    return { verified }
  }

  /** Returns the authenticated user's public profile. */
  async me(userId: number): Promise<SafeUser> {
    const db = getDb()
    const { rows } = await db.query<User>(
      'SELECT id, tenant_id, email, full_name, role, presence, active, totp_secret FROM users WHERE id = $1',
      [userId],
    )
    const user = rows[0]
    if (!user) {
      throw Errors.notFound('user')
    }
    return toSafeUser(user)
  }

  // ---- internal helpers -------------------------------------------------

  private async issueTokensForUser(user: User): Promise<AuthTokenPair & { user: SafeUser }> {
    const tokens = await this.mintPair(user)
    return { ...tokens, user: toSafeUser(user) }
  }

  private async mintPair(user: User): Promise<AuthTokenPair> {
    const accessPayload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
    }
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    })

    // Refresh token: random opaque bytes encoded, then signed. The hash of
    // the signed token is what we store, so the stored row cannot be replayed.
    const raw = randomToken()
    const refreshPayload: RefreshPayload = { sub: user.id, tokenHash: hashToken(raw) }
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    })

    // Persist a hash of the refresh token so rotation / revocation can
    // verify the presented token without storing it in plaintext.
    const refreshHash = hashToken(refreshToken)
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d'
    const db = getDb()
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3::text)::interval)`,
      [user.id, refreshHash, secondsFromDuration(refreshExpiresIn) + ' seconds'],
    )

    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    }
  }
}

/** SHA-256 hash a token for storage / lookup. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Generate a cryptographically random refresh-token seed. */
function randomToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
}

/** Strip sensitive fields before returning a user to the client. */
function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    fullName: user.full_name ?? null,
    role: user.role,
    presence: user.presence,
    active: user.active,
    twoFactorEnabled: Boolean(user.totp_secret),
  }
}

/**
 * Convert a human duration like "30d", "12h", "15m", "3600s" into seconds,
 * for expressing a refresh-token expiry as a Postgres interval.
 */
function secondsFromDuration(duration: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(duration.trim())
  if (!match) {
    // Fall back to 30 days for anything we don't recognize.
    return 30 * 24 * 60 * 60
  }
  const value = parseInt(match[1], 10)
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * (multipliers[unit] ?? 86400)
}
