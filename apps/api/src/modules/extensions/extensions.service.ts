import { Injectable, Logger } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { getDb } from '@pbx/db'
import type { Extension } from '@pbx/db'
import { Errors, AppError } from '@pbx/common'
import { scopedQuery, scopedQueryOne } from '../../common/db/scoped'
import type { CreateExtensionDto } from './dto/create-extension.dto'
import type { UpdateExtensionDto } from './dto/update-extension.dto'

const SECRET_BYTES = 16

/**
 * Extension CRUD, always scoped to the current tenant.
 *
 * On create a per-extension SIP secret is generated with
 * {@link crypto.randomBytes} (hex) — the telephony service reads this to build
 * Asterisk PJSIP auth rows. This is the second module demonstrating the
 * {@link scopedQuery} / {@link scopedQueryOne} helpers.
 */
@Injectable()
export class ExtensionsService {
  private readonly logger = new Logger(ExtensionsService.name)

  async list(tenantId: number): Promise<Extension[]> {
    return scopedQuery<Extension>(
      tenantId,
      `SELECT id, tenant_id, user_id, ext_number, secret, caller_id, context, webrtc, created_at, updated_at
       FROM extensions WHERE tenant_id = $1 ORDER BY ext_number ASC`,
    )
  }

  async getById(tenantId: number, id: number): Promise<Extension> {
    return scopedQueryOne<Extension>(
      tenantId,
      'extension',
      `SELECT id, tenant_id, user_id, ext_number, secret, caller_id, context, webrtc, created_at, updated_at
       FROM extensions WHERE tenant_id = $1 AND id = $2`,
      [id],
    )
  }

  async create(tenantId: number, dto: CreateExtensionDto): Promise<Extension> {
    const secret = randomBytes(SECRET_BYTES).toString('hex')
    const db = getDb()
    try {
      const { rows } = await db.query<Extension>(
        `INSERT INTO extensions (tenant_id, user_id, ext_number, secret, caller_id, context, webrtc)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, tenant_id, user_id, ext_number, secret, caller_id, context, webrtc, created_at, updated_at`,
        [
          tenantId,
          dto.user_id ?? null,
          dto.ext_number,
          secret,
          dto.caller_id ?? null,
          dto.context ?? 'default',
          dto.webrtc ?? true,
        ],
      )
      this.logger.log(`Created extension ${dto.ext_number} for tenant ${tenantId}`)
      return rows[0]
    } catch (err) {
      // unique(tenant_id, ext_number) violation → friendly conflict.
      if (isUniqueViolation(err)) {
        throw new AppError('conflict', `Extension ${dto.ext_number} already exists`, 409)
      }
      throw err
    }
  }

  async update(tenantId: number, id: number, dto: UpdateExtensionDto): Promise<Extension> {
    const fields: string[] = []
    const values: unknown[] = []
    let idx = 2
    if (dto.user_id !== undefined) {
      fields.push(`user_id = $${idx++}`)
      values.push(dto.user_id)
    }
    if (dto.caller_id !== undefined) {
      fields.push(`caller_id = $${idx++}`)
      values.push(dto.caller_id)
    }
    if (dto.context !== undefined) {
      fields.push(`context = $${idx++}`)
      values.push(dto.context)
    }
    if (dto.webrtc !== undefined) {
      fields.push(`webrtc = $${idx++}`)
      values.push(dto.webrtc)
    }
    if (fields.length === 0) {
      return this.getById(tenantId, id)
    }
    fields.push(`updated_at = now()`)
    values.push(id)
    const db = getDb()
    const { rows } = await db.query<Extension>(
      `UPDATE extensions SET ${fields.join(', ')} WHERE tenant_id = $1 AND id = $${idx}
       RETURNING id, tenant_id, user_id, ext_number, secret, caller_id, context, webrtc, created_at, updated_at`,
      [tenantId, ...values],
    )
    if (rows.length === 0) {
      throw Errors.notFound('extension')
    }
    return rows[0]
  }

  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query(
      'DELETE FROM extensions WHERE tenant_id = $1 AND id = $2',
      [tenantId, id],
    )
    if (rowCount === 0) {
      throw Errors.notFound('extension')
    }
  }

  /**
   * Return the SIP/WebRTC connection parameters for the currently
   * authenticated user's primary extension. The browser softphone (JSSIP)
   * uses this to register against Asterisk PJSIP via WSS.
   *
   * Public host and WSS port come from env vars (PUBLIC_HOST, PJSIP_WSS_PORT).
   * STUN/TURN servers come from env (COTURN_HOST / COTURN_PORT / TURNS_PORT);
   * when unset, sensible defaults matching the deployment are used.
   */
  async getMySipConfig(tenantId: number, userId: number): Promise<{
    extension: string
    secret: string
    domain: string
    wssUrl: string
    stunServers: string[]
    turnServers: { urls: string[]; credential?: string; username?: string }[]
  }> {
    const db = getDb()
    const { rows } = await db.query<{ ext_number: string; secret: string }>(
      'SELECT ext_number, secret FROM extensions WHERE tenant_id = $1 AND user_id = $2 ORDER BY id LIMIT 1',
      [tenantId, userId],
    )
    if (rows.length === 0) {
      throw Errors.notFound('extension')
    }
    const ext = rows[0]
    const publicHost = process.env.PUBLIC_HOST ?? process.env.SIP_DOMAIN ?? 'localhost'
    const wssPort = process.env.PJSIP_WSS_PORT ?? '8089'
    // When WSS goes through the Nginx reverse proxy on port 443 (the common
    // deployment), omit the port so the browser uses the default 443 and
    // benefits from the Let's Encrypt cert on Nginx rather than Asterisk's
    // self-signed cert on 8089.
    const wssUrl = wssPort === '443'
      ? `wss://${publicHost}/ws`
      : `wss://${publicHost}:${wssPort}/ws`
    const stunHost = process.env.COTURN_HOST ?? publicHost
    const stunPort = process.env.COTURN_PORT ?? '3478'
    const turnsPort = process.env.TURNS_PORT ?? '5349'
    const turnUser = process.env.TURN_USER ?? ''
    const turnPass = process.env.TURN_PASS ?? ''
    const stunServers = [`stun:${stunHost}:${stunPort}`]
    const turnServers: { urls: string[]; credential?: string; username?: string }[] = []
    const turnUrls = [
      `turn:${stunHost}:${stunPort}?transport=udp`,
      `turn:${stunHost}:${stunPort}?transport=tcp`,
      `turns:${stunHost}:${turnsPort}?transport=tcp`,
    ]
    turnServers.push({
      urls: turnUrls,
      ...(turnUser && turnPass ? { username: turnUser, credential: turnPass } : {}),
    })
    return {
      extension: ext.ext_number,
      secret: ext.secret,
      domain: publicHost,
      wssUrl,
      stunServers,
      turnServers,
    }
  }
}

/** Detect a Postgres unique_violation (SQLSTATE 23505) from a raw error. */
function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === '23505'
  }
  return false
}
