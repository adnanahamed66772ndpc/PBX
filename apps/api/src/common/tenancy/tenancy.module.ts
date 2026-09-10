import { Global, Module } from '@nestjs/common'
import { TenantContext } from './tenant-context'
import { TenancyInterceptor } from './tenancy.interceptor'

/**
 * Global tenancy infrastructure.
 *
 * Declaring the module `@Global()` makes {@link TenantContext} (and the
 * request-scoped {@link TenancyInterceptor}) injectable in every feature
 * module without each one re-importing it. `TenantContext` is request-scoped,
 * so every HTTP request resolves a fresh instance that the interceptor
 * populates from the authenticated principal.
 */
@Global()
@Module({
  providers: [TenantContext, TenancyInterceptor],
  exports: [TenantContext, TenancyInterceptor],
})
export class TenancyModule {}
