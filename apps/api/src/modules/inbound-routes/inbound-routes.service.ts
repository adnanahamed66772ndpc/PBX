import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { InboundRoute } from '@pbx/db'
import { Errors } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateInboundRouteDto } from './dto/create-inbound-route.dto'
import type { UpdateInboundRouteDto } from './dto/update-inbound-route.dto'

const SELECT = `id, tenant_id, name, description, destination, priority, created_at`

/** Inbound route CRUD, always scoped by tenant_id. */
@Injectable()
export class InboundRoutesService {
  private readonly logger = new Logger(InboundRoutesService.name)

  async list(tenantId: number): Promise<InboundRoute[]> {
    return scopedQuery<InboundRoute>(
      tenantId,
      `SELECT ${SELECT} FROM inbound_routes WHERE tenant_id = $1 ORDER BY priority ASC, id ASC`,
    )
  }

  async getById(tenantId: number, id: number): Promise<InboundRoute> {
    return scopedQueryOne<InboundRoute>(
      tenantId,
      'inbound_route',
      `SELECT ${SELECT} FROM inbound_routes WHERE tenant_id = $1 AND id = $2`,
      [id],
    )
  }

  async create(tenantId: number, dto: CreateInboundRouteDto): Promise<InboundRoute> {
    const db = getDb()
    const { rows } = await db.query<InboundRoute>(
      `INSERT INTO inbound_routes (tenant_id, name, description, destination, priority)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT}`,
      [tenantId, dto.name, dto.description ?? null, dto.destination, dto.priority ?? 10],
    )
    this.logger.log(`Created inbound route ${rows[0].id} for tenant ${tenantId}`)
    return rows[0]
  }

  async update(tenantId: number, id: number, dto: UpdateInboundRouteDto): Promise<InboundRoute> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name) }
    if (dto.description !== undefined) { fields.push(`description = $${idx++}`); values.push(dto.description) }
    if (dto.destination !== undefined) { fields.push(`destination = $${idx++}`); values.push(dto.destination) }
    if (dto.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(dto.priority) }
    if (fields.length === 0) return this.getById(tenantId, id)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<InboundRoute>(
      `UPDATE inbound_routes SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${SELECT}`,
      [tenantId, ...values],
    )
    if (rows.length === 0) throw Errors.notFound('inbound_route')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM inbound_routes WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    if (rowCount === 0) throw Errors.notFound('inbound_route')
  }
}
