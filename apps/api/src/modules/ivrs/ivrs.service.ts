import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { Ivr } from '@pbx/db'
import { Errors } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateIvrDto } from './dto/create-ivr.dto'
import type { UpdateIvrDto } from './dto/update-ivr.dto'

const SELECT = `id, tenant_id, name, greeting, menu, timeout, created_at`

/** IVR CRUD; the `menu` column is JSONB (stored/returned as a parsed array). */
@Injectable()
export class IvrsService {
  private readonly logger = new Logger(IvrsService.name)

  async list(tenantId: number): Promise<Ivr[]> {
    return scopedQuery<Ivr>(tenantId, `SELECT ${SELECT} FROM ivrs WHERE tenant_id = $1 ORDER BY name`)
  }

  async getById(tenantId: number, id: number): Promise<Ivr> {
    return scopedQueryOne<Ivr>(tenantId, 'ivr', `SELECT ${SELECT} FROM ivrs WHERE tenant_id = $1 AND id = $2`, [id])
  }

  async create(tenantId: number, dto: CreateIvrDto): Promise<Ivr> {
    const db = getDb()
    const { rows } = await db.query<Ivr>(
      `INSERT INTO ivrs (tenant_id, name, greeting, menu, timeout)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING ${SELECT}`,
      [
        tenantId,
        dto.name,
        dto.greeting ?? null,
        JSON.stringify(dto.menu ?? []),
        dto.timeout ?? 5,
      ],
    )
    this.logger.log(`Created IVR ${rows[0].id} for tenant ${tenantId}`)
    return rows[0]
  }

  async update(tenantId: number, id: number, dto: UpdateIvrDto): Promise<Ivr> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name) }
    if (dto.greeting !== undefined) { fields.push(`greeting = $${idx++}`); values.push(dto.greeting) }
    if (dto.menu !== undefined) { fields.push(`menu = $${idx++}::jsonb`); values.push(JSON.stringify(dto.menu)) }
    if (dto.timeout !== undefined) { fields.push(`timeout = $${idx++}`); values.push(dto.timeout) }
    if (fields.length === 0) return this.getById(tenantId, id)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<Ivr>(
      `UPDATE ivrs SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${SELECT}`,
      [tenantId, ...values],
    )
    if (rows.length === 0) throw Errors.notFound('ivr')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM ivrs WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    if (rowCount === 0) throw Errors.notFound('ivr')
  }
}
