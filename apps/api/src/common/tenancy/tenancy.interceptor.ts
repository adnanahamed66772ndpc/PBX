import { Inject, Injectable, Scope, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Observable } from 'rxjs'
import { TenantContext, type AuthenticatedUser } from './tenant-context'

/**
 * Populates the request-scoped {@link TenantContext} from the authenticated
 * principal found on `request.user`.
 *
 * The JWT strategy (or any auth strategy) is responsible for attaching the
 * validated user to `request.user`. This interceptor then normalizes it into
 * the TenantContext that request-scoped services may read. It is itself
 * request-scoped so it can inject the request-scoped TenantContext and the
 * REQUEST token without a cross-scope DI error; controllers opt in via
 * `@UseInterceptors(TenancyInterceptor)`.
 *
 * Note: most controllers in this codebase instead read the authoritative
 * tenantId straight from `@CurrentUser()` and pass it explicitly into services
 * (which keeps those services singleton-safe). This interceptor/TenantContext
 * pair is the request-scoped alternative for handlers that prefer it.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenancyInterceptor implements NestInterceptor {
  constructor(
    @Inject(REQUEST) private readonly request: Record<string, unknown>,
    private readonly tenantContext: TenantContext,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = this.request.user as AuthenticatedUser | undefined
    if (user) {
      this.tenantContext.setUser({
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
      })
    }
    return next.handle()
  }
}
