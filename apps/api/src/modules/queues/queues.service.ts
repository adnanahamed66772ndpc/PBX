import { Injectable, Logger } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { Queue } from '@pbx/db'
import { Errors, AppError } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateQueueDto } from './dto/create-queue.dto'
import type { UpdateQueueDto } from './dto/update-queue.dto'
import type { AddQueueMemberDto } from './dto/add-queue-member.dto'

const SELECT = `id, tenant_id, name, strategy, timeout, wrapup_time, max_callers, created_at`
const MEMBER_SELECT = `id, tenant_id, queue_id, extension_id, penalty, paused`

export interface QueueMember {
  id: number
  tenant_id: number
  queue_id: number
  extension_id: number
  penalty: number
  paused: boolean
}

/** Queue CRUD + queue-member management, always scoped by tenant_id. */
@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name)

  async list(tenantId: number): Promise<Queue[]> {
    return scopedQuery<Queue>(tenantId, `SELECT ${SELECT} FROM queues WHERE tenant_id = $1 ORDER BY name`)
  }

  async getById(tenantId: number, id: number): Promise<Queue> {
    return scopedQueryOne<Queue>(tenantId, 'queue', `SELECT ${SELECT} FROM queues WHERE tenant_id = $1 AND id = $2`, [id])
  }

  async create(tenantId: number, dto: CreateQueueDto): Promise<Queue> {
    const db = getDb()
    try {
      const { rows } = await db.query<Queue>(
        `INSERT INTO queues (tenant_id, name, strategy, timeout, wrapup_time, max_callers)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${SELECT}`,
        [tenantId, dto.name, dto.strategy ?? 'ringall', dto.timeout ?? 30, dto.wrapup_time ?? 5, dto.max_callers ?? 0],
      )
      this.logger.log(`Created queue ${rows[0].id} for tenant ${tenantId}`)
      return rows[0]
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError('conflict', `Queue ${dto.name} already exists`, 409)
      }
      throw err
    }
  }

  async update(tenantId: number, id: number, dto: UpdateQueueDto): Promise<Queue> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.name !== undefined) { fields.push(`name = $${idx++}`); values.push(dto.name) }
    if (dto.strategy !== undefined) { fields.push(`strategy = $${idx++}`); values.push(dto.strategy) }
    if (dto.timeout !== undefined) { fields.push(`timeout = $${idx++}`); values.push(dto.timeout) }
    if (dto.wrapup_time !== undefined) { fields.push(`wrapup_time = $${idx++}`); values.push(dto.wrapup_time) }
    if (dto.max_callers !== undefined) { fields.push(`max_callers = $${idx++}`); values.push(dto.max_callers) }
    if (fields.length === 0) return this.getById(tenantId, id)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<Queue>(
      `UPDATE queues SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${SELECT}`,
      [tenantId, ...values],
    )
    if (rows.length === 0) throw Errors.notFound('queue')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query('DELETE FROM queues WHERE tenant_id = $1 AND id = $2', [tenantId, id])
    if (rowCount === 0) throw Errors.notFound('queue')
  }

  // ---- queue members ----------------------------------------------------

  async listMembers(tenantId: number, queueId: number): Promise<QueueMember[]> {
    // Verify the queue belongs to the tenant before listing its members.
    await this.getById(tenantId, queueId)
    return scopedQuery<QueueMember>(
      tenantId,
      `SELECT ${MEMBER_SELECT} FROM queue_members WHERE tenant_id = $1 AND queue_id = $2 ORDER BY penalty ASC, id ASC`,
      [queueId],
    )
  }

  async addMember(tenantId: number, queueId: number, dto: AddQueueMemberDto): Promise<QueueMember> {
    await this.getById(tenantId, queueId)
    // Verify the extension belongs to the same tenant.
    const extRows = await scopedQuery<{ id: number }>(
      tenantId,
      'SELECT id FROM extensions WHERE tenant_id = $1 AND id = $2',
      [dto.extension_id],
    )
    if (extRows.length === 0) {
      throw new AppError('validation_error', `extension ${dto.extension_id} does not belong to this tenant`, 422, {
        extension_id: dto.extension_id,
      })
    }
    const db = getDb()
    try {
      const { rows } = await db.query<QueueMember>(
        `INSERT INTO queue_members (tenant_id, queue_id, extension_id, penalty, paused)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${MEMBER_SELECT}`,
        [tenantId, queueId, dto.extension_id, dto.penalty ?? 0, dto.paused ?? false],
      )
      return rows[0]
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError('conflict', 'extension is already a member of this queue', 409)
      }
      throw err
    }
  }

  async removeMember(tenantId: number, queueId: number, memberId: number): Promise<void> {
    await this.getById(tenantId, queueId)
    const db = getDb()
    const { rowCount } = await db.query(
      'DELETE FROM queue_members WHERE tenant_id = $1 AND queue_id = $2 AND id = $3',
      [tenantId, queueId, memberId],
    )
    if (rowCount === 0) throw Errors.notFound('queue_member')
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505'
  }
  return false
}
