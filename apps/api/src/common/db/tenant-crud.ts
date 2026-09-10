import { getDb } from '@pbx/db'
import type { Db } from '@pbx/db'
import { Errors } from '@pbx/common'

/**
 * Generic tenant-scoped CRUD helpers.
 *
 * Each resource module builds its SQL with `tenant_id = $1` (the authoritative
 * tenant) and passes the *remaining* parameters separately; these helpers
 * prepend the tenantId so the bound parameter numbering stays consistent and
 * cross-tenant access by id is impossible.
 */

export interface CrudConfig<T> {
  /** Table name, for not-found messages and delete by id. */
  table: string
  /** SELECT list for list/getById (without the tenant filter). */
  select: string
}

/**
 * Minimal generic CRUD surface. Modules that share the plain list/get/update/
 * delete shape can instantiate this and call through it; modules with custom
 * logic (extensions secret generation, queue members, CDR filters) keep their
 * own service implementations. The pool is fetched lazily inside each method
 * so simply providing this class never opens a DB connection.
 */
export class TenantCrud<T extends Record<string, unknown>> {
  constructor(private readonly cfg: CrudConfig<T>) {}

  private get db(): Db {
    return getDb()
  }

  listAll(tenantId: number, orderBy = 'id ASC'): Promise<T[]> {
    return this.db
      .query<T>(
        `SELECT ${this.cfg.select} FROM ${this.cfg.table} WHERE tenant_id = $1 ORDER BY ${orderBy}`,
        [tenantId],
      )
      .then((r) => r.rows)
  }

  findOne(tenantId: number, id: number): Promise<T> {
    return this.db
      .query<T>(
        `SELECT ${this.cfg.select} FROM ${this.cfg.table} WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id],
      )
      .then((r) => {
        if (r.rows.length === 0) throw Errors.notFound(this.cfg.table)
        return r.rows[0]
      })
  }

  updateOne(
    tenantId: number,
    id: number,
    assignments: Record<string, unknown>,
    updatedAtColumn?: string,
  ): Promise<T> {
    const cols = Object.keys(assignments)
    if (cols.length === 0) return this.findOne(tenantId, id)
    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 2 // $1 = tenant_id
    for (const col of cols) {
      setClauses.push(`${col} = $${idx++}`)
      values.push(assignments[col])
    }
    if (updatedAtColumn) setClauses.push(`${updatedAtColumn} = now()`)
    values.push(id)
    return this.db
      .query<T>(
        `UPDATE ${this.cfg.table} SET ${setClauses.join(', ')} WHERE tenant_id = $1 AND id = $${idx} RETURNING ${this.cfg.select}`,
        [tenantId, ...values],
      )
      .then((r) => {
        if (r.rows.length === 0) throw Errors.notFound(this.cfg.table)
        return r.rows[0]
      })
  }

  deleteOne(tenantId: number, id: number): Promise<void> {
    return this.db
      .query(`DELETE FROM ${this.cfg.table} WHERE tenant_id = $1 AND id = $2`, [tenantId, id])
      .then((r) => {
        if (r.rowCount === 0) throw Errors.notFound(this.cfg.table)
      })
  }
}
