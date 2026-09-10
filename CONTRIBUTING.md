# Contributing

This is a starter scaffold for a multi-tenant PBX/UC platform.

## Development workflow

```bash
pnpm install
cp .env.example .env        # fill in secrets
docker compose up -d postgres redis nats
pnpm db:migrate             # apply migrations
pnpm dev:api                # NestJS :4000
pnpm dev:web                # Next.js :3000
pnpm dev:telephony          # ARI service :5000 (requires Asterisk)
```

## Conventions

- **Tenancy**: every tenant-scoped DB query MUST go through the
  `scopedQuery` helper in `apps/api/src/common/db`. Never trust a
  `tenant_id` from the client.
- **Design tokens**: UI components reference CSS variables from
  `apps/web/src/styles/globals.css`. Do not hardcode hex values.
- **Config envsubst**: telephony engine configs in `deploy/` use `${VAR}`
  placeholders that are substituted at container start (see
  `deploy/README.md`).
- **Migrations**: add a new numbered `packages/db/migrations/NNN_*.sql` file;
  the runner applies them in lexical order inside a transaction.

## Layout

See `README.md` and `docs/architecture.md`.
