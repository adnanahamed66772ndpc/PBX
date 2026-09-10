import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg'

let pool: Pool | null = null

/**
 * A permissive query interface that accepts any row type generic, so callers
 * can write `db.query<User>(sql, params)` without TS complaining about
 * `QueryResultRow` constraints. The cast is safe because `pg` returns rows
 * as plain objects regardless.
 */
export interface TypedDb extends Omit<Pool, 'query'> {
  query<T extends QueryResultRow = any>(
    queryConfig: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>
  query<T extends QueryResultRow = any>(
    queryConfig: any,
  ): Promise<QueryResult<T>>
}

export type Db = TypedDb

/**
 * Shared PostgreSQL connection pool. Lazily created from DATABASE_URL.
 * Call `closeDb()` at process shutdown to drain connections.
 */
export function getDb(): Db {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
      idleTimeoutMillis: 30_000,
    })
    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[db] idle pool error:', err)
    })
  }
  return pool
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/**
 * Run a transaction. The tenant_id scoping is enforced by callers (see
 * apps/api tenancy guard), never by trusting client-supplied input.
 */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
