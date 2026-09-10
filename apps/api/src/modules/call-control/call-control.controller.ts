import { Body, Controller, Delete, Param, Post, UseInterceptors } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CallControlService } from './call-control.service'
import { OriginateCallDto } from './dto/originate-call.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * Call control surface.
 *
 * These endpoints delegate to an injected {@link CallControlService}, whose
 * real implementation talks to Asterisk ARI (lives in apps/telephony). The
 * tenant id is taken from the authenticated principal and forwarded to the
 * telephony service so it can scope the ARI originate request.
 */
@ApiTags('calls')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('calls')
export class CallControlController {
  constructor(private readonly callControl: CallControlService) {}

  @Post('originate')
  @Roles('agent', 'admin', 'owner')
  @ApiOperation({
    summary: 'Originate an outbound call via Asterisk ARI (apps/telephony)',
    description:
      'Delegates to the CallControlService, which posts to the ARI ' +
      'channels endpoint. Returns the new ARI channel id as callId.',
  })
  @ApiResponse({ status: 201, description: 'Call originated; returns the ARI channel id.' })
  @ApiResponse({ status: 501, description: 'Telephony backend not configured.' })
  @ApiResponse({ status: 502, description: 'ARI request failed.' })
  originate(@CurrentUser() user: AuthenticatedUser, @Body() dto: OriginateCallDto): Promise<{ callId: string }> {
    return this.callControl.originate(user.tenantId, dto.fromExt, dto.to)
  }

  @Delete(':channelId')
  @Roles('agent', 'admin', 'owner')
  @ApiOperation({ summary: 'Hang up an active ARI channel' })
  @ApiResponse({ status: 200, description: 'Channel hung up.' })
  @ApiResponse({ status: 501, description: 'Telephony backend not configured.' })
  async hangup(@Param('channelId') channelId: string): Promise<{ channelId: string; hungup: true }> {
    await this.callControl.hangup(channelId)
    return { channelId, hungup: true }
  }
}
