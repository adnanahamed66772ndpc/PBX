import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseInterceptors,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { DidsService } from './dids.service'
import { CreateDidDto } from './dto/create-did.dto'
import { UpdateDidDto } from './dto/update-did.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('dids')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('dids')
export class DidsController {
  constructor(private readonly didsService: DidsService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'List DID numbers in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.didsService.list(user.tenantId!)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Get a DID by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.didsService.getById(user.tenantId!, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Claim a DID number' })
  @ApiResponse({ status: 201, description: 'DID created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDidDto) {
    return this.didsService.create(user.tenantId!, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a DID' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDidDto,
  ) {
    return this.didsService.update(user.tenantId!, id, dto)
  }

  @Put(':id/assign')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Assign (or clear) an inbound route for a DID' })
  @ApiResponse({ status: 200, description: 'DID inbound route updated.' })
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body('inbound_route_id') inboundRouteId: number | null,
  ) {
    return this.didsService.update(user.tenantId!, id, { inbound_route_id: inboundRouteId ?? null })
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Release a DID' })
  @ApiResponse({ status: 200, description: 'DID deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.didsService.remove(user.tenantId!, id)
    return { id, deleted: true }
  }
}
