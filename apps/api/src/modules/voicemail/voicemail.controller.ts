import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Res, StreamableFile, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Response } from 'express'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'
import { VoicemailService } from './voicemail.service'
import { SetReadDto } from './dto/set-read.dto'

/**
 * Voicemail surface. Backed by the Asterisk app_voicemail spool, synced into
 * the `voicemails` table. Viewers are excluded: recordings are call details.
 */
@ApiTags('voicemail')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('voicemail')
export class VoicemailController {
  constructor(private readonly voicemail: VoicemailService) {}

  @Get()
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List voicemail messages for the current tenant (syncs from the Asterisk spool)' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.voicemail.list(user.tenantId!)
  }

  @Get(':id/audio')
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Stream a voicemail recording' })
  @ApiParam({ name: 'id', type: Number })
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, contentType } = await this.voicemail.openAudio(user.tenantId!, id)
    res.set({
      'content-type': contentType,
      'cache-control': 'private, no-store',
    })
    return new StreamableFile(stream)
  }

  @Patch(':id/read')
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Mark a voicemail read or unread' })
  @ApiParam({ name: 'id', type: Number })
  setRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetReadDto,
  ) {
    return this.voicemail.setRead(user.tenantId!, id, dto.read)
  }

  @Delete(':id')
  @Roles('superadmin', 'owner', 'admin')
  @ApiOperation({ summary: 'Delete a voicemail (DB row + Asterisk spool files)' })
  @ApiParam({ name: 'id', type: Number })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.voicemail.remove(user.tenantId!, id)
  }
}
