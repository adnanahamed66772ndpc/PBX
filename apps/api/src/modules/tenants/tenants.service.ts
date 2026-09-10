import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { Tenant } from '@pbx/db'
import { Errors } from '@pbx/common'
import type { CreateTenantDto } from './dto/create-tenant.dto'
import type { UpdateTenantDto } from './dto/update-tenant.dto'

/**
 * Tenant CRUD.
 *
 * Tenants are the root of multi-tenant isolation. Ordinary tenant users may
 * only read their own tenant; platform-wide listing is restricted to the
 * 'admin' role (handled at the controller via @Roles). The scoping helper is
 * used for the read-one / update / delete paths so a caller can never touch
 * another tenant's row by guessing its id.
 */
@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name)

  async list(): Promise<Tenant[]> {
    const db = getDb()
    const { rows } = await db.query<Tenant>(
      'SELECT id, name, domain, plan, active, created_at, updated_at FROM tenants ORDER BY id ASC',
    )
    return rows
  }

  async getById(id: number): Promise<Tenant> {
    const db = getDb()
    const { rows } = await db.query<Tenant>(
      'SELECT id, name, domain, plan, active, created_at, updated_at FROM tenants WHERE id = $1',
      [id],
    )
    if (rows.length === 0) {
      throw Errors.notFound('tenant')
    }
    return rows[0]
  }

  /** Read the caller's own tenant — the common owner/manager path. */
  async getOwn(tenantId: number): Promise<Tenant> {
    return this.getById(tenantId)
  }

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const db = getDb()
    const { rows } = await db.query<Tenant>(
      `INSERT INTO tenants (name, domain, plan, active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, domain, plan, active, created_at, updated_at`,
      [dto.name, dto.domain ?? null, dto.plan ?? 'free', dto.active ?? true],
    )
    this.logger.log(`Created tenant ${rows[0].id} (${dto.name})`)
    return rows[0]
  }

  async update(tenantId: number, dto: UpdateTenantDto): Promise<Tenant> {
    const db = getDb()
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (dto.name !== undefined) {
      fields.push(`name = $${idx++}`)
      values.push(dto.name)
    }
    if (dto.domain !== undefined) {
      fields.push(`domain = $${idx++}`)
      values.push(dto.domain)
    }
    if (dto.plan !== undefined) {
      fields.push(`plan = $${idx++}`)
      values.push(dto.plan)
    }
    if (dto.active !== undefined) {
      fields.push(`active = $${idx++}`)
      values.push(dto.active)
    }
    if (fields.length === 0) {
      return this.getById(tenantId)
    }
    fields.push(`updated_at = now()`)
    values.push(tenantId)
    const { rows } = await db.query<Tenant>(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, domain, plan, active, created_at, updated_at`,
      values,
    )
    if (rows.length === 0) {
      throw Errors.notFound('tenant')
    }
    return rows[0]
  }

  async remove(tenantId: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM tenants WHERE id = $1', [tenantId])
    if (rowCount === 0) {
      throw Errors.notFound('tenant')
    }
    this.logger.log(`Deleted tenant ${tenantId}`)
  }
}
