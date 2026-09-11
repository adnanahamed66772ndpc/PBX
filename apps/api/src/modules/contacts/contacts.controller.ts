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
import { ContactsService } from './contacts.service'
import { CreateContactDto } from './dto/create-contact.dto'
import { UpdateContactDto } from './dto/update-contact.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

@ApiTags('contacts')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List contacts in the current tenant' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.list(user.tenantId!)
  }

  @Get(':id')
  @Roles('superadmin', 'owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get a contact by id' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.contactsService.getById(user.tenantId!, id)
  }

  @Post()
  @Roles('superadmin', 'owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Create a contact' })
  @ApiResponse({ status: 201, description: 'Contact created.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.tenantId!, dto)
  }

  @Patch(':id')
  @Roles('superadmin', 'owner', 'admin', 'manager')
  @ApiOperation({ summary: 'Update a contact' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.tenantId!, id, dto)
  }

  @Delete(':id')
  @Roles('superadmin', 'owner', 'admin')
  @ApiOperation({ summary: 'Delete a contact' })
  @ApiResponse({ status: 200, description: 'Contact deleted.' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ id: number; deleted: true }> {
    await this.contactsService.remove(user.tenantId!, id)
    return { id, deleted: true }
  }
}
