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
import { ExtensionsService } from './extensions.service'
import { CreateExtensionDto } from './dto/create-extension.dto'
import { UpdateExtensionDto } from './dto/update-extension.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('extensions')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get()
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List extensions in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.extensionsService.list(user.tenantId)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get an extension by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.extensionsService.getById(user.tenantId, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Provision a new SIP extension (generates a secret)' })
  @ApiResponse({ status: 201, description: 'Extension created with generated secret.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExtensionDto) {
    return this.extensionsService.create(user.tenantId, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update an extension' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExtensionDto,
  ) {
    return this.extensionsService.update(user.tenantId, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete an extension' })
  @ApiResponse({ status: 200, description: 'Extension deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.extensionsService.remove(user.tenantId, id)
    return { id, deleted: true }
  }
}
