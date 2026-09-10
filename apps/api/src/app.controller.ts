import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from './common/decorators/public.decorator'

/**
 * Liveness / readiness probe. Exposed at the root path and intentionally
 * public so external health checks can reach it without a JWT.
 */
@ApiTags('health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  health(): { status: string; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() }
  }
}
