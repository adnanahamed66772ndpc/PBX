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
import { TrunksService } from './trunks.service'
import { CreateSipTrunkDto } from './dto/create-trunk.dto'
import { UpdateSipTrunkDto } from './dto/update-trunk.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('trunks')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('trunks')
export class TrunksController {
  constructor(private readonly trunksService: TrunksService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'List SIP trunks in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.trunksService.list(user.tenantId!)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Get a SIP trunk by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.trunksService.getById(user.tenantId!, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Register a SIP trunk' })
  @ApiResponse({ status: 201, description: 'Trunk created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSipTrunkDto) {
    return this.trunksService.create(user.tenantId!, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a SIP trunk' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSipTrunkDto,
  ) {
    return this.trunksService.update(user.tenantId!, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a SIP trunk' })
  @ApiResponse({ status: 200, description: 'Trunk deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.trunksService.remove(user.tenantId!, id)
    return { id, deleted: true }
  }
}
