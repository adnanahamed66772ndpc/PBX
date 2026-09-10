import { Injectable, Logger } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { getDb } from '@pbx/db'
import type { User } from '@pbx/db'
import { Errors } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateUserDto } from './dto/create-user.dto'
import type { UpdateUserDto } from './dto/update-user.dto'

/**
 * User CRUD scoped to the current tenant.
 *
 * Demonstrates the {@link scopedQuery} / {@link scopedQueryOne} helpers: the
 * authoritative tenantId (from TenantContext) is bound as $1 on every query,
 * making cross-tenant access impossible even if a caller supplies another
 * tenant's resource id.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name)

  async list(tenantId: number): Promise<Omit<User, 'password_hash'>[]> {
    const rows = await scopedQuery<User>(
      tenantId,
      `SELECT id, tenant_id, email, full_name, role, presence, active, totp_secret, created_at, updated_at
       FROM users WHERE tenant_id = $1 ORDER BY id ASC`,
    )
    return rows.map(stripPassword)
  }

  async getById(tenantId: number, id: number): Promise<Omit<User, 'password_hash'>> {
    const row = await scopedQueryOne<User>(
      tenantId,
      'user',
      `SELECT id, tenant_id, email, full_name, role, presence, active, totp_secret, created_at, updated_at
       FROM users WHERE tenant_id = $1 AND id = $2`,
      [id],
    )
    return stripPassword(row)
  }

  async create(tenantId: number, dto: CreateUserDto): Promise<Omit<User, 'password_hash'>> {
    const passwordHash = await bcrypt.hash(dto.password, 12)
    const db = getDb()
    const { rows } = await db.query<User>(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, role, presence, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, email, full_name, role, presence, active, totp_secret, created_at, updated_at`,
      [
        tenantId,
        dto.email,
        passwordHash,
        dto.fullName ?? null,
        dto.role ?? 'user',
        dto.presence ?? 'available',
        dto.active ?? true,
      ],
    )
    return stripPassword(rows[0])
  }

  async update(
    tenantId: number,
    id: number,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'password_hash'>> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2 // $1 is reserved for tenant_id
    if (dto.email !== undefined) {
      fields.push(`email = $${idx++}`)
      values.push(dto.email)
    }
    if (dto.password !== undefined) {
      fields.push(`password_hash = $${idx++}`)
      values.push(await bcrypt.hash(dto.password, 12))
    }
    if (dto.fullName !== undefined) {
      fields.push(`full_name = $${idx++}`)
      values.push(dto.fullName)
    }
    if (dto.role !== undefined) {
      fields.push(`role = $${idx++}`)
      values.push(dto.role)
    }
    if (dto.presence !== undefined) {
      fields.push(`presence = $${idx++}`)
      values.push(dto.presence)
    }
    if (dto.active !== undefined) {
      fields.push(`active = $${idx++}`)
      values.push(dto.active)
    }
    if (fields.length === 0) {
      return this.getById(tenantId, id)
    }
    fields.push(`updated_at = now()`)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<User>(
      `UPDATE users SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx}
       RETURNING id, tenant_id, email, full_name, role, presence, active, totp_secret, created_at, updated_at`,
      [tenantId, ...values],
    )
    if (rows.length === 0) {
      throw Errors.notFound('user')
    }
    return stripPassword(rows[0])
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query(
      'DELETE FROM users WHERE tenant_id = $1 AND id = $2',
      [tenantId, id],
    )
    if (rowCount === 0) {
      throw Errors.notFound('user')
    }
  }
}

/**
 * The shared {@link User} type omits `password_hash`. Our list/get/create
 * queries never SELECT it, so rows are safe to return directly; stripPassword
 * is a defensive guard typed to tolerate a row that might still carry it.
 */
type UserRow = User & { password_hash?: string | null }

/** Drop the password_hash before returning a user to the client. */
function stripPassword(user: UserRow): Omit<User, 'password_hash'> {
  const { password_hash: _passwordHash, ...rest } = user
  return rest
}
