import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { IvrsService } from './ivrs.service'
import { CreateIvrDto } from './dto/create-ivr.dto'
import { UpdateIvrDto } from './dto/update-ivr.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('ivrs')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('ivrs')
export class IvrsController {
  constructor(private readonly ivrsService: IvrsService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'List IVRs in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ivrsService.list(user.tenantId)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Get an IVR by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.ivrsService.getById(user.tenantId, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create an IVR menu (menu stored as JSONB)' })
  @ApiResponse({ status: 201, description: 'IVR created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIvrDto) {
    return this.ivrsService.create(user.tenantId, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update an IVR' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIvrDto,
  ) {
    return this.ivrsService.update(user.tenantId, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete an IVR' })
  @ApiResponse({ status: 200, description: 'IVR deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.ivrsService.remove(user.tenantId, id)
    return { id, deleted: true }
  }
}
