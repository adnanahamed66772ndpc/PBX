import { Injectable, Scope } from '@nestjs/common'
import type { Role } from '@pbx/db'

/**
 * The authenticated principal, attached to request.user by the JWT guard /
 * strategies and mirrored here for downstream services.
 */
export interface AuthenticatedUser {
  id: number
  tenantId: number
  role: Role
  email: string
}

/**
 * Request-scoped holder for the current tenant + principal.
 *
 * Because it is scoped to the REQUEST, every HTTP request gets a fresh
 * instance populated by {@link TenancyInterceptor} from the validated JWT
 * payload. Services inject this to read the authoritative tenantId — never
 * the request body or query string — so tenant isolation is enforced at the
 * data-access layer rather than at each controller call site.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private currentUser: AuthenticatedUser | null = null

  /** Set by the tenancy interceptor after authentication resolves. */
  setUser(user: AuthenticatedUser): void {
    this.currentUser = user
  }

  /** Returns the authenticated principal, or throws if not set. */
  getRequestContext(): AuthenticatedUser {
    if (!this.currentUser) {
      throw new Error('TenantContext has no authenticated user — request not scoped')
    }
    return this.currentUser
  }

  /** Convenience accessor for the tenant id. */
  get tenantId(): number {
    return this.getRequestContext().tenantId
  }

  /** True once the interceptor has populated the principal. */
  get isSet(): boolean {
    return this.currentUser !== null
  }
}
