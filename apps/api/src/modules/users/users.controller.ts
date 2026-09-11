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
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * User management within the authenticated tenant.
 *
 * The tenantId is taken only from the validated principal (@CurrentUser),
 * never from the request body or query — see the UsersService scoping.
 */
@ApiTags('users')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'List users in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user.tenantId!)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Get a user by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.getById(user.tenantId!, id)
  }

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a user in the current tenant' })
  @ApiResponse({ status: 201, description: 'User created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.tenantId!, dto)
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.tenantId!, id, dto)
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.usersService.remove(user.tenantId!, id)
    return { id, deleted: true }
  }
}
