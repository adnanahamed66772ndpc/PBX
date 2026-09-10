import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthenticatedUser } from '../tenancy/tenant-context'

/**
 * Parameter decorator that extracts the authenticated principal from
 * `request.user`. Use as `@CurrentUser() user: AuthenticatedUser`.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user) {
      return undefined
    }
    return data ? user[data] : user
  },
)
