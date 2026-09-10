import { getDb } from '@pbx/db'
import { Errors } from '@pbx/common'
import type { Db } from '@pbx/db'
import type { QueryResult } from 'pg'

/**
 * Tenancy-safe query helpers.
 *
 * The single rule of multi-tenant data access in this codebase: every
 * tenant-scoped SQL statement MUST scope by `tenant_id` taken from the
 * authenticated {@link TenantContext}, never from request input. These helpers
 * make that convention mechanical: callers pass the authoritative tenantId and
 * a SQL string whose WHERE clause already binds it, and the helpers build the
 * parameter array so the tenantId is always the first bound value.
 *
 * Convention for the `sql` argument: write the tenant filter as
 * `AND tenant_id = $1` (for updates/deletes) or `WHERE tenant_id = $1`
 * (for selects), and number the *rest* of your parameters starting at $2.
 * Pass only the rest of the parameters in `params`; this helper prepends the
 * tenantId as $1.
 */

/**
 * Run a tenant-scoped SELECT/UPDATE/DELETE and return the rows.
 *
 * @param tenantId  authoritative tenant id from TenantContext
 * @param sql       SQL with tenant_id bound as $1 and remaining params from $2
 * @param params    the parameter values for $2.. (NOT including tenantId)
 */
export async function scopedQuery<T = Record<string, unknown>>(
  tenantId: number,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db: Db = getDb()
  const result: QueryResult = await db.query(sql, [tenantId, ...params])
  return result.rows as T[]
}

/**
 * Run a tenant-scoped query expected to return a single row. Throws a 404
 * `not_found` AppError when the row is absent — the common case for
 * "resource belongs to another tenant" or "does not exist".
 */
export async function scopedQueryOne<T = Record<string, unknown>>(
  tenantId: number,
  resource: string,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const rows = await scopedQuery<T>(tenantId, sql, params)
  if (rows.length === 0) {
    throw Errors.notFound(resource)
  }
  return rows[0]
}

/**
 * Build a tenant-scoped parameter tuple. Useful when a caller needs to feed a
 * raw pool client (e.g. inside a `tx()` block) rather than the pool directly.
 * Returns `[tenantId, ...params]`.
 */
export function scopedParams(tenantId: number, params: unknown[] = []): unknown[] {
  return [tenantId, ...params]
}
