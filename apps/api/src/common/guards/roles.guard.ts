import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'
import type { AuthenticatedUser } from '../tenancy/tenant-context'
import { Errors } from '@pbx/common'

/**
 * RBAC guard. Reads the @Roles(...) metadata set on the handler or controller
 * and compares it against `request.user.role`. The principal is assumed to be
 * present (this guard runs after JwtAuthGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!requiredRoles || requiredRoles.length === 0) {
      // No @Roles() declared → any authenticated user may proceed.
      return true
    }
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>()
    const user = request.user
    if (!user || !user.role) {
      throw Errors.unauthorized()
    }
    // superadmin bypasses all role checks — full platform + tenant access.
    if (user.role === 'superadmin') {
      return true
    }
    if (!requiredRoles.includes(user.role)) {
      throw Errors.forbidden()
    }
    return true
  }
}
