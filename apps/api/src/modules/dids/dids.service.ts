import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { DidNumber } from '@pbx/db'
import { Errors, AppError } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateDidDto } from './dto/create-did.dto'
import type { UpdateDidDto } from './dto/update-did.dto'

const SELECT = `id, tenant_id, number, inbound_route_id, active, created_at`

/**
 * DID number CRUD + inbound-route assignment.
 *
 * When a DID is assigned an inbound route, the route is validated to belong to
 * the same tenant — a DID must never point at another tenant's route.
 */
@Injectable()
export class DidsService {
  private readonly logger = new Logger(DidsService.name)

  async list(tenantId: number): Promise<DidNumber[]> {
    return scopedQuery<DidNumber>(tenantId, `SELECT ${SELECT} FROM did_numbers WHERE tenant_id = $1 ORDER BY number`)
  }

  async getById(tenantId: number, id: number): Promise<DidNumber> {
    return scopedQueryOne<DidNumber>(
      tenantId,
      'did_number',
      `SELECT ${SELECT} FROM did_numbers WHERE tenant_id = $1 AND id = $2`,
      [id],
    )
  }

  async create(tenantId: number, dto: CreateDidDto): Promise<DidNumber> {
    if (dto.inbound_route_id) {
      await this.assertRouteOwned(tenantId, dto.inbound_route_id)
    }
    const db = getDb()
    try {
      const { rows } = await db.query<DidNumber>(
        `INSERT INTO did_numbers (tenant_id, number, inbound_route_id, active)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SELECT}`,
        [tenantId, dto.number, dto.inbound_route_id ?? null, dto.active ?? true],
      )
      this.logger.log(`Created DID ${dto.number} for tenant ${tenantId}`)
      return rows[0]
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError('conflict', `DID ${dto.number} is already claimed`, 409)
      }
      throw err
    }
  }

  async update(tenantId: number, id: number, dto: UpdateDidDto): Promise<DidNumber> {
    if (dto.inbound_route_id) {
      await this.assertRouteOwned(tenantId, dto.inbound_route_id)
    }
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.number !== undefined) { fields.push(`number = $${idx++}`); values.push(dto.number) }
    if (dto.inbound_route_id !== undefined) { fields.push(`inbound_route_id = $${idx++}`); values.push(dto.inbound_route_id) }
    if (dto.active !== undefined) { fields.push(`active = $${idx++}`); values.push(dto.active) }
    if (fields.length === 0) return this.getById(tenantId, id)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<DidNumber>(
      `UPDATE did_numbers SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${SELECT}`,
      [tenantId, ...values],
    )
    if (rows.length === 0) throw Errors.notFound('did_number')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM did_numbers WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    if (rowCount === 0) throw Errors.notFound('did_number')
  }

  /** Ensure an inbound route id belongs to the tenant before referencing it. */
  private async assertRouteOwned(tenantId: number, routeId: number): Promise<void> {
    const rows = await scopedQuery<{ id: number }>(
      tenantId,
      'SELECT id FROM inbound_routes WHERE tenant_id = $1 AND id = $2',
      [routeId],
    )
    if (rows.length === 0) {
      throw new AppError('validation_error', `inbound_route ${routeId} does not belong to this tenant`, 422, {
        inbound_route_id: routeId,
      })
    }
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505'
  }
  return false
}
