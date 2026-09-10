import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { CreateTenantDto } from './dto/create-tenant.dto'
import { UpdateTenantDto } from './dto/update-tenant.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('tenants')
@ApiBearerAuth('access-token')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all tenants (platform admin only)' })
  @ApiResponse({ status: 200, description: 'All tenants.' })
  list() {
    return this.tenantsService.list()
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the caller\'s own tenant' })
  @ApiResponse({ status: 200, description: 'The authenticated user\'s tenant.' })
  getOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantsService.getOwn(user.tenantId)
  }

  @Get(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Get a tenant by id (platform admin only)' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.tenantsService.getById(id)
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a tenant (platform admin only)' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto)
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a tenant (platform admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto)
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a tenant (platform admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ id: number; deleted: true }> {
    await this.tenantsService.remove(id)
    return { id, deleted: true }
  }
}
