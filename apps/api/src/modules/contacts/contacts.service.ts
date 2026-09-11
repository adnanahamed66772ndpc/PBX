import { Injectable } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { Contact } from '@pbx/db'
import { Errors } from '@pbx/common'
import type { CreateContactDto } from './dto/create-contact.dto'
import type { UpdateContactDto } from './dto/update-contact.dto'

const FIELDS = `id, tenant_id, full_name, email, phone, extension, department, created_at, updated_at`

@Injectable()
export class ContactsService {
  async list(tenantId: number): Promise<Contact[]> {
    const db = getDb()
    const { rows } = await db.query<Contact>(
      `SELECT ${FIELDS} FROM contacts WHERE tenant_id = $1 ORDER BY full_name ASC`,
      [tenantId],
    )
    return rows
  }

  async getById(tenantId: number, id: number): Promise<Contact> {
    const db = getDb()
    const { rows } = await db.query<Contact>(
      `SELECT ${FIELDS} FROM contacts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    )
    if (rows.length === 0) throw Errors.notFound('contact')
    return rows[0]
  }

  async create(tenantId: number, dto: CreateContactDto): Promise<Contact> {
    const db = getDb()
    const { rows } = await db.query<Contact>(
      `INSERT INTO contacts (tenant_id, full_name, email, phone, extension, department)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${FIELDS}`,
      [tenantId, dto.fullName, dto.email ?? null, dto.phone, dto.extension ?? null, dto.department ?? null],
    )
    return rows[0]
  }

  async update(tenantId: number, id: number, dto: UpdateContactDto): Promise<Contact> {
    const db = getDb()
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 1
    if (dto.fullName !== undefined) { fields.push(`full_name = $${idx++}`); values.push(dto.fullName) }
    if (dto.email !== undefined) { fields.push(`email = $${idx++}`); values.push(dto.email) }
    if (dto.phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(dto.phone) }
    if (dto.extension !== undefined) { fields.push(`extension = $${idx++}`); values.push(dto.extension) }
    if (dto.department !== undefined) { fields.push(`department = $${idx++}`); values.push(dto.department) }
    if (fields.length === 0) return this.getById(tenantId, id)
    fields.push(`updated_at = now()`)
    values.push(tenantId, id)
    const { rows } = await db.query<Contact>(
      `UPDATE contacts SET ${fields.join(', ')} WHERE tenant_id = $${idx++} AND id = $${idx}
       RETURNING ${FIELDS}`,
      values,
    )
    if (rows.length === 0) throw Errors.notFound('contact')
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query(
      'DELETE FROM contacts WHERE tenant_id = $1 AND id = $2',
      [tenantId, id],
    )
    if (rowCount === 0) throw Errors.notFound('contact')
  }
}
