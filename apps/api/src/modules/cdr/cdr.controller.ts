import { Controller, Get, Param, ParseIntPipe, Query, UseInterceptors } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { CdrService } from './cdr.service'
import { CdrQueryDto } from './dto/cdr-query.dto'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/tenancy/current-user.decorator'
import { TenancyInterceptor } from '../../common/tenancy/tenancy.interceptor'
import type { AuthenticatedUser } from '../../common/tenancy/tenant-context'

/**
 * Call Detail Records — read-only, always tenant-scoped.
 */
@ApiTags('cdr')
@ApiBearerAuth('access-token')
@UseInterceptors(TenancyInterceptor)
@Controller('cdr')
export class CdrController {
  constructor(private readonly cdrService: CdrService) {}

  @Get()
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'List call records with filters + pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of CDR rows.' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: CdrQueryDto) {
    return this.cdrService.list(user.tenantId!, query)
  }

  @Get(':id')
  @Roles('owner', 'admin', 'manager', 'agent')
  @ApiOperation({ summary: 'Get a single call record by id' })
  @ApiResponse({ status: 200, description: 'A single CDR row.' })
  @ApiResponse({ status: 404, description: 'Call record not found.' })
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.cdrService.getById(user.tenantId!, id)
  }
}
