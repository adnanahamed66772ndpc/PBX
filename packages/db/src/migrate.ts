/**
 * Minimal migration runner.
 * Applies every *.sql file in ../migrations in lexical order inside a
 * transaction, recording applied versions in a `schema_migrations` table.
 *
 * Usage: `tsx src/migrate.ts up` | `tsx src/migrate.ts reset`
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getDb, closeDb } from './client.js'

// __dirname is available natively in CommonJS output.
// tsx (ESM dev runner) also polyfills it, so this works in both modes.
const MIGRATIONS_DIR = join(__dirname, '..', 'migrations')

async function ensureMigrationsTable(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version   VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
}

async function up(): Promise<void> {
  const db = getDb()
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const client = await db.connect()
  try {
    await ensureMigrationsTable(client)
    const { rows } = await client.query('SELECT version FROM schema_migrations')
    const applied = new Set(rows.map((r: any) => r.version))

    let count = 0
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file])
        await client.query('COMMIT')
        // eslint-disable-next-line no-console
        console.log(`[migrate] applied ${file}`)
        count++
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[migrate] done, ${count} migration(s) applied`)
  } finally {
    client.release()
  }
}

async function reset(): Promise<void> {
  const db = getDb()
  // Drop in dependency-safe reverse order, then re-run up.
  const tables = [
    'invoices',
    'subscriptions',
    'rate_cards',
    'messages',
    'voicemails',
    'call_records',
    'queue_members',
    'queues',
    'ivrs',
    'did_numbers',
    'inbound_routes',
    'sip_trunks',
    'extensions',
    'departments',
    'refresh_tokens',
    'users',
    'audit_log',
    'tenants',
    'schema_migrations',
  ]
  await db.query(`DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE`)
  // eslint-disable-next-line no-console
  console.log('[migrate] reset: dropped all tables')
  await up()
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? 'up'
  try {
    if (cmd === 'up') await up()
    else if (cmd === 'reset') await reset()
    else throw new Error(`unknown command: ${cmd}`)
  } finally {
    await closeDb()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] error:', err)
  process.exit(1)
})
