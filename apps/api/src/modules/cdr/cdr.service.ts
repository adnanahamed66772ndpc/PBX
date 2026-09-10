import { Injectable } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { CallRecord } from '@pbx/db'
import { Errors } from '@pbx/common'
import { pageToLimitOffset } from '../../common/dto/pagination.dto'
import type { CdrQueryDto } from './dto/cdr-query.dto'

const SELECT = `id, tenant_id, call_id, channel_id, from_ext, to_ext, did, direction, status,
  start_time, answer_time, end_time, duration_sec, billsec, disposition, recording_url`

export interface PaginatedCdr {
  data: CallRecord[]
  page: number
  limit: number
  total: number
}

/**
 * Call Detail Record access — strictly read-only and always tenant-scoped.
 *
 * Builds a dynamic WHERE clause by stacking filters, with the tenant_id
 * always bound as $1 so a caller can never read another tenant's CDR even by
 * guessing a call id.
 */
@Injectable()
export class CdrService {
  async list(tenantId: number, query: CdrQueryDto): Promise<PaginatedCdr> {
    const { limit, offset } = pageToLimitOffset(query.page, query.limit)

    const where: string[] = ['tenant_id = $1']
    const params: unknown[] = [tenantId]
    let idx = 2

    if (query.direction) { where.push(`direction = $${idx++}`); params.push(query.direction) }
    if (query.status) { where.push(`status = $${idx++}`); params.push(query.status) }
    if (query.fromExt) { where.push(`from_ext = $${idx++}`); params.push(query.fromExt) }
    if (query.toExt) { where.push(`to_ext = $${idx++}`); params.push(query.toExt) }
    if (query.did) { where.push(`did = $${idx++}`); params.push(query.did) }
    if (query.from) { where.push(`start_time >= $${idx++}`); params.push(query.from) }
    if (query.to) { where.push(`start_time < $${idx++}`); params.push(query.to) }

    const whereClause = where.join(' AND ')
    const db = getDb()

    const countParams = [...params]
    const totalRes = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM call_records WHERE ${whereClause}`,
      countParams,
    )
    const total = parseInt(totalRes.rows[0].count, 10)

    const listParams = [...params, limit, offset]
    const { rows } = await db.query<CallRecord>(
      `SELECT ${SELECT} FROM call_records WHERE ${whereClause}
       ORDER BY start_time DESC LIMIT $${idx++} OFFSET $${idx}`,
      listParams,
    )

    return { data: rows, page: query.page, limit, total }
  }

  async getById(tenantId: number, id: number): Promise<CallRecord> {
    const db = getDb()
    const { rows } = await db.query<CallRecord>(
      `SELECT ${SELECT} FROM call_records WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    )
    if (rows.length === 0) {
      throw Errors.notFound('call_record')
    }
    return rows[0]
  }
}
