import { SetMetadata } from '@nestjs/common'

/**
 * Roles required to access a route. Applied as `@Roles('admin', 'owner')` and
 * enforced by {@link RolesGuard}.
 */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles)
