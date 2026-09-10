# @pbx/api — Control Plane REST API

NestJS 10 TypeScript backend for the multi-tenant PBX/UC platform. It is the
**control plane**: tenants, users, extensions, trunks, routing, queues, IVRs,
CDR, auth/RBAC, and a call-origination surface that delegates to the telephony
service. Asterisk ARI integration lives in `apps/telephony`, **not** here — the
API only defines a `CallControlService` interface + a stub/default impl.

## Stack

- NestJS 10 (modular monolith), TypeScript `strict` + `experimentalDecorators`
- PostgreSQL via `@pbx/db` (shared pool, migrations, domain types)
- JWT (access + refresh rotation) via `@nestjs/jwt` + `passport-jwt`
- RBAC via `@Roles()` + `RolesGuard`; tenancy via request-scoped `TenantContext`
- OpenAPI/Swagger at `/docs` via `@nestjs/swagger`; hand-written subset in `swagger/openapi.yaml`
- NATS publisher (graceful no-op when the broker is absent)

## Module list

| Path | Route | Purpose |
| --- | --- | --- |
| `src/app.controller.ts` | `GET /health` | Public liveness probe |
| `src/modules/auth` | `/auth/*` | Register, login, refresh (JWT rotation), 2FA TOTP stub, `/auth/me` |
| `src/modules/tenants` | `/tenants` | Tenant CRUD (platform `admin` for cross-tenant; `*/tenants/me` for own) |
| `src/modules/users` | `/users` | User CRUD within the current tenant |
| `src/modules/extensions` | `/extensions` | SIP extension CRUD; generates a per-extension secret on create |
| `src/modules/trunks` | `/trunks` | SIP trunk CRUD |
| `src/modules/inbound-routes` | `/inbound-routes` | Inbound route CRUD (destination tokens like `ivr:main`) |
| `src/modules/dids` | `/dids` | DID CRUD + `PUT /dids/:id/assign` to bind an inbound route |
| `src/modules/queues` | `/queues` | Queue CRUD + `/queues/:id/members` member management |
| `src/modules/ivrs` | `/ivrs` | IVR CRUD; `menu` stored as JSONB |
| `src/modules/cdr` | `/cdr` | Read-only CDR list (filters + pagination) and `GET /cdr/:id` |
| `src/modules/events` | — | NATS `TelephonyEvent` publisher (stubbed, no-op if NATS unavailable) |
| `src/modules/call-control` | `/calls` | `POST /calls/originate`, `DELETE /calls/:channelId` → `CallControlService` (ARI) |

Supporting infrastructure lives under `src/common/`:

- `tenancy/` — `TenantContext` (request-scoped), `TenancyInterceptor`, `CurrentUser` decorator, `TenancyModule` (global).
- `guards/` — `JwtAuthGuard` (global `APP_GUARD`, `@Public()` bypass), `RolesGuard` (global `APP_GUARD`, reads `@Roles()`).
- `decorators/` — `@Roles(...)`, `@Public()`.
- `filters/` — `AppExceptionFilter` (normalized `{ error: { code, message, details? } }` envelope).
- `db/` — `scoped.ts` (`scopedQuery`, `scopedQueryOne`, `scopedParams`) and `tenant-crud.ts` (generic CRUD helper).
- `dto/` — `PaginationDto`.
- `pipes/` — note explaining the class-validator DTO choice (no Zod).

## Tenancy enforcement pattern

**One rule:** every tenant-scoped SQL statement binds the authoritative
`tenant_id` as `$1`, and that id comes **only** from the authenticated
principal — never from the request body, query, or path.

The flow:

1. The `jwt` passport strategy verifies the bearer token, loads the user from
   the DB, and attaches the validated principal
   (`{ id, tenantId, role, email }`) to `request.user`.
2. The global `JwtAuthGuard` (`APP_GUARD`) enforces a valid token on every
   route unless it is marked `@Public()`.
3. Controllers read the tenant id via `@CurrentUser() user` and **pass it
   explicitly** into service methods — e.g. `usersService.list(user.tenantId)`.
   (`TenancyInterceptor`, applied per-controller, mirrors the same principal
   into the request-scoped `TenantContext` for handlers that prefer that
   accessor — keeping the services themselves singleton-safe.)
4. Services run all data access through the `scopedQuery` / `scopedQueryOne`
   helpers (`src/common/db/scoped.ts`), which prepend `tenantId` as `$1`. A
   caller that supplies another tenant's resource id simply gets a 404 because
   `WHERE tenant_id = $1 AND id = $2` matches no row — cross-tenant access is
   impossible by construction.

`scopedQuery` / `scopedQueryOne` are used in: `users`, `extensions`, `trunks`,
`inbound-routes`, `dids`, `queues`, `ivrs`. The `cdr` service builds a dynamic
`WHERE` that always starts with `tenant_id = $1`. `TenantCrud<T>`
(`src/common/db/tenant-crud.ts`) offers a generic list/get/update/delete
surface for modules with a plain CRUD shape.

## RBAC

- Roles (`@pbx/db`): `owner | admin | manager | agent | user`.
- `@Roles('admin', 'owner')` on handlers sets metadata read by the global
  `RolesGuard`; a missing/insufficient role throws `403 forbidden`.
- Cross-tenant operations (listing all tenants, mutating any tenant) are
  restricted to platform `admin`.

## Auth

- Access JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`) carries `{ sub, tenantId, role, email }`.
- Refresh JWT (`JWT_REFRESH_EXPIRES_IN`) carries `{ sub, tokenHash }`; the
  signed token's SHA-256 hash is stored in `refresh_tokens` and rotated on use
  (the consumed row is revoked atomically).
- `POST /auth/register` creates a tenant + its `owner` user in one `tx()`.
- 2FA: `POST /auth/2fa/verify` is a **stub** that accepts any 6-digit code when
  the user has a `totp_secret`; replace with RFC-6238 TOTP derivation.
- Passwords hashed with `bcryptjs` (cost 12); `password_hash` is never
  returned (the shared `User` type omits it; the API strips it defensively).

## Error envelope

All errors are normalized by `AppExceptionFilter` into:

```json
{ "error": { "code": "not_found", "message": "extension not found", "details": { ... } } }
```

- `@pbx/common` `AppError` → its own `status` / `code` / `details`.
- Nest `HttpException` (incl. class-validator) → mapped status + `validation_error`.
- Anything else → `500 internal_error`. Stack traces are only logged in dev.

## OpenAPI

- A live, generated spec is served at **`/docs`** by `@nestjs/swagger`
  (configured in `src/main.ts`). Controllers use `@ApiTags`, DTOs use
  `@ApiProperty`, and bearer auth is documented via `@ApiBearerAuth('access-token')`.
- A hand-written reference subset is checked in at
  **`swagger/openapi.yaml`** (`/auth/login`, `/tenants`, `/extensions`, `/cdr`).

## Environment variables

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL DSN used by `@pbx/db` |
| `JWT_SECRET` | yes | — | JWT signing secret |
| `JWT_EXPIRES_IN` | no | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | no | `30d` | Refresh token lifetime |
| `CORS_ORIGIN` | no | `*` | Comma-separated origins, or `*` |
| `ARI_URL` | no | — | Asterisk ARI base URL (enables `/calls/originate`) |
| `NATS_URL` | no | — | NATS URL; absent → event publishing is a no-op |
| `API_PORT` | no | `4000` | HTTP listen port |
| `NODE_ENV` | no | — | `development` enables stack traces in errors |
| `LOG_LEVEL` | no | `info` | `@pbx/common` logger level |

## How to run

From the monorepo root (workspace links `@pbx/common` and `@pbx/db`):

```bash
pnpm install
pnpm --filter @pbx/common build     # build shared packages first
pnpm --filter @pbx/db build
cp .env.example .env                # set DATABASE_URL, JWT_SECRET, …
pnpm db:migrate                     # apply migrations

# API
pnpm dev:api                        # = pnpm --filter @pbx/api start:dev  (nest start --watch)
```

Or, from `apps/api` directly:

```bash
pnpm start:dev      # watch mode (nest start --watch)
pnpm build          # nest build → dist/
pnpm start          # node dist/main.js
pnpm typecheck      # tsc --noEmit
pnpm lint
```

The API boots even without NATS or ARI: `EventsService` logs a warning and
no-ops when `nats`/`NATS_URL` is unavailable, and `DefaultCallControlService`
returns `501 not_implemented` until `ARI_URL` is set.

## Notes

- DB access everywhere uses `import { getDb, tx } from '@pbx/db'`. The pool is
  created lazily from `DATABASE_URL`.
- ARI integration lives in `apps/telephony`; this package only defines the
  `CallControlService` interface and a default stub so the API documents the
  contract and boots standalone.
- Only NestJS, `class-validator`/`class-transformer`, and `@nestjs/swagger`
  decorators are used; no TypeScript decorators beyond those.
