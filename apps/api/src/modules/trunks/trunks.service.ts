import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { SipTrunk } from '@pbx/db'
import { Errors } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateSipTrunkDto } from './dto/create-trunk.dto'
import type { UpdateSipTrunkDto } from './dto/update-trunk.dto'

const SELECT = `id, tenant_id, name, hostname, port, transport, username, password, active, created_at`

/** SIP trunk CRUD, always scoped by tenant_id. */
@Injectable()
export class TrunksService {
  private readonly logger = new Logger(TrunksService.name)

  async list(tenantId: number): Promise<SipTrunk[]> {
    return scopedQuery<SipTrunk>(tenantId, `SELECT ${SELECT} FROM sip_trunks WHERE tenant_id = $1 ORDER BY name`)
  }

  async getById(tenantId: number, id: number): Promise<SipTrunk> {
    return scopedQueryOne<SipTrunk>(
      tenantId,
      'sip_trunk',
      `SELECT ${SELECT} FROM sip_trunks WHERE tenant_id = $1 AND id = $2`,
      [id],
    )
  }

  async create(tenantId: number, dto: CreateSipTrunkDto): Promise<SipTrunk> {
    const db = getDb()
    const { rows } = await db.query<SipTrunk>(
      `INSERT INTO sip_trunks (tenant_id, name, hostname, port, transport, username, password, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${SELECT}`,
      [
        tenantId,
        dto.name,
        dto.hostname,
        dto.port ?? 5060,
        dto.transport ?? 'udp',
        dto.username ?? null,
        dto.password ?? null,
        dto.active ?? true,
      ],
    )
    this.logger.log(`Created sip trunk ${rows[0].id} for tenant ${tenantId}`)
    return rows[0]
  }

  async update(tenantId: number, id: number, dto: UpdateSipTrunkDto): Promise<SipTrunk> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name) }
    if (dto.hostname !== undefined) { fields.push(`hostname = $${idx++}`); values.push(dto.hostname) }
    if (dto.port !== undefined) { fields.push(`port = $${idx++}`); values.push(dto.port) }
    if (dto.transport !== undefined) { fields.push(`transport = $${idx++}`); values.push(dto.transport) }
    if (dto.username !== undefined) { fields.push(`username = $${idx++}`); values.push(dto.username) }
    if (dto.password !== undefined) { fields.push(`password = $${idx++}`); values.push(dto.password) }
    if (dto.active !== undefined) { fields.push(`active = $${idx++}`); values.push(dto.active) }
    if (fields.length === 0) return this.getById(tenantId, id)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<SipTrunk>(
      `UPDATE sip_trunks SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${SELECT}`,
      [tenantId, ...values],
    )
    if (rows.length === 0) throw Errors.notFound('sip_trunk')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM sip_trunks WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    if (rowCount === 0) throw Errors.notFound('sip_trunk')
  }
}
