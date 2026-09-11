import { Injectable, Logger } from '@nestjs/common'
import { createReadStream } from 'fs'
import { readFile, readdir, stat, unlink } from 'fs/promises'
import { extname, join, resolve } from 'path'
import { Readable } from 'stream'
import { getDb } from '@pbx/db'
import { Errors } from '@pbx/common'

/**
 * Voicemail service.
 *
 * Recordings are produced by Asterisk's app_voicemail: a no-answer call is
 * continued into the `pbx-vm` dialplan context, which runs
 * `VoiceMail(<ext>@default)` and writes `msgNNNN.{txt,wav}` under
 * `/var/spool/asterisk/voicemail/default/<mailbox>/INBOX/`.
 *
 * This service keeps the `voicemails` table in sync with that spool: each
 * list() call rescans the directory, parses the `msgNNNN.txt` metadata,
 * resolves the mailbox to a tenant/extension row, and upserts by the
 * absolute file path (unique index, migration 007). Playback streams the
 * .wav straight off disk; deletes remove both the DB row and the spool files.
 */

/** Root of the Asterisk voicemail spool (override for tests). */
const SPOOL_ROOT = resolve(process.env.VM_SPOOL_DIR ?? '/var/spool/asterisk/voicemail/default')

/** Parsed shape of an Asterisk voicemail msgNNNN.txt metadata file. */
interface SpoolMessage {
  /** Absolute path of the .txt metadata file. */
  txtPath: string
  /** Absolute path of the audio file (wav preferred, then WAV/gsm). */
  audioPath: string
  /** Mailbox (extension number) the message was left for. */
  mailbox: string
  /** Caller number extracted from `CallerID=Name <num>`. */
  callerNum: string | null
  durationSec: number
  /** File mtime — Asterisk's Origdate format is locale-dependent, mtime is not. */
  receivedAt: Date
}

/** Row shape returned to the web client (see apps/web Voicemail type). */
export interface VoicemailDto {
  id: number
  from: string
  to: string
  durationSec: number
  receivedAt: string
  read: boolean
  transcription: string | null
  audioUrl: string
}

@Injectable()
export class VoicemailService {
  private readonly logger = new Logger(VoicemailService.name)

  /**
   * List voicemails for a tenant. Rescans the spool first so messages left
   * since the previous call appear immediately.
   */
  async list(tenantId: number): Promise<VoicemailDto[]> {
    await this.syncFromSpool().catch((err) =>
      this.logger.warn(`voicemail spool scan failed: ${(err as Error).message}`),
    )
    const db = getDb()
    const { rows } = await db.query<{
      id: number
      caller_id: string | null
      duration_sec: number
      read: boolean
      created_at: Date
      ext_number: string | null
    }>(
      `SELECT v.id, v.caller_id, v.duration_sec, v.read, v.created_at, e.ext_number
       FROM voicemails v
       LEFT JOIN extensions e ON e.id = v.extension_id
       WHERE v.tenant_id = $1
       ORDER BY v.created_at DESC
       LIMIT 200`,
      [tenantId],
    )
    return rows.map((r) => ({
      id: r.id,
      from: r.caller_id ?? 'Unknown',
      to: r.ext_number ?? '—',
      durationSec: r.duration_sec,
      receivedAt: new Date(r.created_at).toISOString(),
      read: r.read,
      transcription: null,
      audioUrl: `/voicemail/${r.id}/audio`,
    }))
  }

  /** Mark a message read/unread. */
  async setRead(tenantId: number, id: number, read: boolean): Promise<void> {
    const db = getDb()
    const { rowCount } = await db.query(
      'UPDATE voicemails SET read = $3 WHERE id = $1 AND tenant_id = $2',
      [id, tenantId, read],
    )
    if (!rowCount) throw Errors.notFound('voicemail')
  }

  /**
   * Delete a message: remove the spool audio + metadata files, then the row.
   * The path check keeps deletes confined to the voicemail spool even if a
   * tampered DB row pointed elsewhere.
   */
  async remove(tenantId: number, id: number): Promise<void> {
    const db = getDb()
    const { rows } = await db.query<{ file_path: string }>(
      'SELECT file_path FROM voicemails WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    )
    if (!rows.length) throw Errors.notFound('voicemail')
    const base = rows[0].file_path
    for (const suffix of ['', '.txt', '.wav', '.WAV', '.gsm']) {
      const p = base + suffix
      if (this.isInsideSpool(p)) await unlink(p).catch(() => {})
    }
    await db.query('DELETE FROM voicemails WHERE id = $1 AND tenant_id = $2', [id, tenantId])
  }

  /**
   * Resolve the audio file for a message and return a streaming response
   * tuple. Only the stored audio path (plus its known Asterisk suffixes) may
   * be served, and only when it resolves inside the spool root.
   */
  async openAudio(tenantId: number, id: number): Promise<{ stream: Readable; contentType: string }> {
    const db = getDb()
    const { rows } = await db.query<{ file_path: string }>(
      'SELECT file_path FROM voicemails WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    )
    if (!rows.length) throw Errors.notFound('voicemail')
    const base = rows[0].file_path
    // file_path stores the .txt metadata path; prefer the plain (wav) audio.
    const candidates = [base, `${base}.wav`, `${base}.WAV`, `${base}.gsm`]
    for (const candidate of candidates) {
      if (!this.isInsideSpool(candidate)) continue
      try {
        const info = await stat(candidate)
        if (!info.isFile()) continue
        const stream = createReadStream(candidate)
        return { stream, contentType: contentTypeFor(candidate) }
      } catch {
        // try next candidate
      }
    }
    throw Errors.notFound('voicemail audio file')
  }

  // ── spool sync ───────────────────────────────────────────────────────

  /**
   * Scan the spool and upsert every message we have not stored yet.
   * Mailboxes without a matching extensions row are skipped (unknown tenant),
   * which also keeps the multi-tenant boundary: a stray mailbox can never
   * surface under the wrong tenant.
   */
  private async syncFromSpool(): Promise<void> {
    let entries: string[]
    try {
      entries = await readdir(SPOOL_ROOT)
    } catch {
      // Spool dir missing/unreadable — nothing to sync.
      return
    }
    const messages: SpoolMessage[] = []
    for (const mailbox of entries) {
      const inbox = join(SPOOL_ROOT, mailbox, 'INBOX')
      let files: string[]
      try {
        files = await readdir(inbox)
      } catch {
        continue
      }
      for (const file of files) {
        if (!file.endsWith('.txt')) continue
        const parsed = await this.parseMessage(inbox, file, mailbox)
        if (parsed) messages.push(parsed)
      }
    }
    if (!messages.length) return

    const db = getDb()
    // One query resolves every mailbox to its tenant/extension.
    const mailboxes = [...new Set(messages.map((m) => m.mailbox))]
    const { rows } = await db.query<{ id: number; tenant_id: number; ext_number: string }>(
      'SELECT id, tenant_id, ext_number FROM extensions WHERE ext_number = ANY($1)',
      [mailboxes],
    )
    const byExt = new Map(rows.map((r) => [r.ext_number, r]))

    for (const msg of messages) {
      const ext = byExt.get(msg.mailbox)
      if (!ext) continue
      await db.query(
        `INSERT INTO voicemails (tenant_id, extension_id, caller_id, duration_sec, file_path, read, created_at)
         VALUES ($1, $2, $3, $4, $5, FALSE, $6)
         ON CONFLICT (file_path) DO UPDATE
           SET duration_sec = EXCLUDED.duration_sec, caller_id = EXCLUDED.caller_id`,
        [ext.tenant_id, ext.id, msg.callerNum, msg.durationSec, msg.txtPath, msg.receivedAt],
      )
    }
  }

  /** Parse one msgNNNN.txt plus locate its audio sibling. */
  private async parseMessage(inbox: string, file: string, mailbox: string): Promise<SpoolMessage | null> {
    const txtPath = join(inbox, file)
    let raw: string
    try {
      raw = await readFile(txtPath, 'utf8')
    } catch {
      return null
    }
    const fields: Record<string, string> = {}
    for (const line of raw.split(/\r?\n/)) {
      const eq = line.indexOf('=')
      if (eq > 0) fields[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim()
    }
    const audioPath = await this.findAudio(inbox, file)
    if (!audioPath) return null
    let info: { mtime: Date }
    try {
      info = await stat(audioPath)
    } catch {
      return null
    }
    return {
      // Asterisk writes lowercase keys: origmailbox, callerid, duration.
      txtPath,
      audioPath,
      mailbox: fields['origmailbox'] || mailbox,
      callerNum: extractCallerNumber(fields['callerid']),
      durationSec: Math.max(0, parseInt(fields['duration'] ?? '0', 10) || 0),
      receivedAt: info.mtime,
    }
  }

  /** Find the audio sibling of a msgNNNN.txt (wav > WAV > gsm). */
  private async findAudio(inbox: string, txtFile: string): Promise<string | null> {
    const base = txtFile.replace(/\.txt$/i, '')
    for (const ext of ['.wav', '.WAV', '.gsm']) {
      try {
        const p = join(inbox, base + ext)
        const info = await stat(p)
        if (info.isFile()) return p
      } catch {
        // next
      }
    }
    return null
  }

  /** True when `p` resolves inside the spool root (path-traversal guard). */
  private isInsideSpool(p: string): boolean {
    const resolved = resolve(p)
    return resolved === SPOOL_ROOT || resolved.startsWith(SPOOL_ROOT + '/')
  }
}

/** Map an Asterisk recording extension to an HTTP content type. */
function contentTypeFor(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.gsm':
      return 'audio/gsm'
    case '.mp3':
      return 'audio/mpeg'
    default:
      return 'audio/wav'
  }
}

/** Extract the caller number from Asterisk's `Name <num>` CallerID form. */
function extractCallerNumber(callerId: string | undefined): string | null {
  if (!callerId) return null
  const match = callerId.match(/<([^>]+)>/)
  const num = (match ? match[1] : callerId).trim()
  return num || null
}
