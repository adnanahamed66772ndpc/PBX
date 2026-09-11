import { Injectable } from '@nestjs/common'
import { getDb } from '@pbx/db'
import type { CallRecord } from '@pbx/db'

/**
 * Aggregated metrics for the dashboard.
 * `recentCalls` is empty for viewer-role callers (they see counts only).
 */
export interface DashboardSummary {
  callsToday: number
  activeCalls: number
  agentsAvailable: number
  missedCalls: number
  recentCalls: CallRecord[]
}

const CALL_FIELDS = `id, tenant_id, call_id, channel_id, from_ext, to_ext, did,
  direction, status, start_time, answer_time, end_time, duration_sec, billsec,
  disposition, recording_url`

@Injectable()
export class DashboardService {
  async getSummary(tenantId: number, includeDetails: boolean): Promise<DashboardSummary> {
    const db = getDb()

    // Calls today
    const todayRes = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM call_records
       WHERE tenant_id = $1 AND start_time >= date_trunc('day', now())`,
      [tenantId],
    )
    const callsToday = parseInt(todayRes.rows[0].count, 10)

    // Missed calls today (noanswer + failed)
    const missedRes = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM call_records
       WHERE tenant_id = $1 AND start_time >= date_trunc('day', now())
         AND status IN ('noanswer', 'failed')`,
      [tenantId],
    )
    const missedCalls = parseInt(missedRes.rows[0].count, 10)

    // Agents available (users with role agent/owner/admin/manager and presence available)
    const agentsRes = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM users
       WHERE tenant_id = $1 AND active = true AND presence = 'available'
         AND role IN ('agent', 'owner', 'admin', 'manager')`,
      [tenantId],
    )
    const agentsAvailable = parseInt(agentsRes.rows[0].count, 10)

    // Active calls (calls with no end_time yet — i.e. in progress)
    const activeRes = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM call_records
       WHERE tenant_id = $1 AND end_time IS NULL`,
      [tenantId],
    )
    const activeCalls = parseInt(activeRes.rows[0].count, 10)

    // Recent calls — only for non-viewer roles (viewer sees counts only)
    let recentCalls: CallRecord[] = []
    if (includeDetails) {
      const recentRes = await db.query<CallRecord>(
        `SELECT ${CALL_FIELDS} FROM call_records
         WHERE tenant_id = $1 ORDER BY start_time DESC LIMIT 10`,
        [tenantId],
      )
      recentCalls = recentRes.rows
    }

    return {
      callsToday,
      activeCalls,
      agentsAvailable,
      missedCalls,
      recentCalls,
    }
  }
}
