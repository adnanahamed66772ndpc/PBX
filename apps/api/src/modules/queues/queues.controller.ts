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
import { QueuesService } from './queues.service'
import { CreateQueueDto } from './dto/create-queue.dto'
import { UpdateQueueDto } from './dto/update-queue.dto'
import { AddQueueMemberDto } from './dto/add-queue-member.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('queues')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List queues in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.queuesService.list(user.tenantId!)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get a queue by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.queuesService.getById(user.tenantId!, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a queue' })
  @ApiResponse({ status: 201, description: 'Queue created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQueueDto) {
    return this.queuesService.create(user.tenantId!, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a queue' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQueueDto,
  ) {
    return this.queuesService.update(user.tenantId!, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a queue' })
  @ApiResponse({ status: 200, description: 'Queue deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.queuesService.remove(user.tenantId!, id)
    return { id, deleted: true }
  }

  // ---- queue members ----------------------------------------------------

  @Get(':id/members')
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List members of a queue' })
  listMembers(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.queuesService.listMembers(user.tenantId!, id)
  }

  @Post(':id/members')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Add an extension as a queue member' })
  @ApiResponse({ status: 201, description: 'Member added.' })
  addMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddQueueMemberDto,
  ) {
    return this.queuesService.addMember(user.tenantId!, id, dto)
  }

  @Delete(':id/members/:memberId')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Remove a queue member' })
  @ApiResponse({ status: 200, description: 'Member removed.' })
  async removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.queuesService.removeMember(user.tenantId!, id, memberId)
    return { id: memberId, deleted: true }
  }
}
