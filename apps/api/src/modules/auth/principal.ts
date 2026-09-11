import type { Role } from '@pbx/db'

/**
 * Claims carried by a signed access JWT.
 *
 * - `sub`      user id
 * - `tenantId` authoritative tenant scope (never re-trusted from request body)
 * - `role`     RBAC role used by the RolesGuard
 * - `email`    for display / audit only
 */
export interface JwtPayload {
  sub: number
  tenantId: number | null
  role: Role
  email: string
}

/**
 * Claims carried by a signed refresh JWT. Kept deliberately minimal so a
 * rotated refresh token cannot itself authorize resource access.
 */
export interface RefreshPayload {
  sub: number
  tokenHash: string
}
