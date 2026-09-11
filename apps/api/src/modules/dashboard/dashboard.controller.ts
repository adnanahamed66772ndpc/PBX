import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { DashboardService, type DashboardSummary } from './dashboard.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * Dashboard — aggregated tenant metrics.
 *
 * All roles can view the summary, but `viewer` gets counts only (recentCalls
 * is empty) while higher roles also get the recent-calls detail list.
 */
@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent', 'viewer')
  @ApiOperation({ summary: 'Dashboard summary — counts + recent calls (viewer: counts only)' })
  @ApiResponse({ status: 200, description: 'Aggregated dashboard metrics.' })
  getSummary(@CurrentUser() user: AuthenticatedUser): Promise<DashboardSummary> {
    // viewer sees counts only; superadmin without a switched tenant gets zeros
    const tenantId = user.tenantId
    if (tenantId === null) {
      return Promise.resolve({
        callsToday: 0,
        activeCalls: 0,
        agentsAvailable: 0,
        missedCalls: 0,
        recentCalls: [],
      })
    }
    const includeDetails = user.role !== 'viewer'
    return this.dashboardService.getSummary(tenantId, includeDetails)
  }
}
