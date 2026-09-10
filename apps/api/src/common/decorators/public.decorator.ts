import { SetMetadata } from '@nestjs/common'

/**
 * Marks a route (or controller) as publicly accessible, bypassing the JWT
 * guard. Enforced by {@link JwtAuthGuard} via the IS_PUBLIC metadata key.
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true)
