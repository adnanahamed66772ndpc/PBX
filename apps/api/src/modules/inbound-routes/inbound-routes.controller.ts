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
import { InboundRoutesService } from './inbound-routes.service'
import { CreateInboundRouteDto } from './dto/create-inbound-route.dto'
import { UpdateInboundRouteDto } from './dto/update-inbound-route.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('inbound-routes')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('inbound-routes')
export class InboundRoutesController {
  constructor(private readonly inboundRoutesService: InboundRoutesService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'List inbound routes in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.inboundRoutesService.list(user.tenantId)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Get an inbound route by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.inboundRoutesService.getById(user.tenantId, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create an inbound route' })
  @ApiResponse({ status: 201, description: 'Inbound route created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInboundRouteDto) {
    return this.inboundRoutesService.create(user.tenantId, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update an inbound route' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInboundRouteDto,
  ) {
    return this.inboundRoutesService.update(user.tenantId, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete an inbound route' })
  @ApiResponse({ status: 200, description: 'Inbound route deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.inboundRoutesService.remove(user.tenantId, id)
    return { id, deleted: true }
  }
}
