# PBX Platform

A multi-tenant PBX/UC platform with a control plane (web UI + API) and a
telephony stack (Asterisk + Kamailio + RTPengine + coturn). This repository
is a **starter scaffold**: real, runnable code across three workstreams that
teams can build on.

## Repository layout

```
.
├── apps/
│   ├── web/            # Next.js 14 frontend — design tokens, components, pages
│   ├── api/            # NestJS 10 backend — auth, RBAC, tenancy, 13 modules
│   └── telephony/      # Node ARI call-control service + NATS event bridge
├── packages/
│   ├── db/             # PostgreSQL: 5 migrations, pg client, migrate runner, types
│   └── common/         # shared logger, AppError/Errors, TelephonyEvent contract
├── deploy/
│   ├── asterisk/       # pjsip.conf, extensions.conf, ari.conf, http.conf, dialplan
│   ├── kamailio/       # kamailio.cfg, dispatcher.list, tls.cfg
│   ├── rtpengine/      # rtpengine.conf
│   ├── coturn/         # turnserver.conf
│   └── ansible/        # playbook.yml, inventory.ini, ansible.cfg
├── docker/             # Dockerfiles + entrypoints for asterisk / kamailio
├── docker-compose.yml  # local dev stack (postgres, redis, nats, telco engines)
└── docs/architecture.md
```

## Quick start

```bash
cp .env.example .env           # fill in secrets
pnpm install                   # install all workspace deps
docker compose up -d postgres redis nats   # start infra deps
pnpm db:migrate                # apply migrations
pnpm dev:api                   # NestJS on :4000
pnpm dev:web                   # Next.js on :3000
pnpm dev:telephony             # ARI service on :5000 (needs Asterisk)
```

The web app reads `NEXT_PUBLIC_API_URL`; the API reads `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGIN`, `NATS_URL`, and `ARI_*`. The shared packages
(`@pbx/db`, `@pbx/common`) export from source — no build step required.

## Multi-tenancy model

Every tenant-scoped table carries a `tenant_id` column with a foreign key to
`tenants`. The API authenticates each request, resolves the caller's
`tenant_id` from the JWT, and injects it into every query — client-supplied
`tenant_id` values are never trusted. See `apps/api/src/common/tenancy`.

## Workstream status

| Workstream        | Status                                   | Location                     |
|-------------------|------------------------------------------|------------------------------|
| Frontend (Next.js)| design tokens, 6 UI components, 6 pages   | `apps/web`                   |
| Backend (NestJS)  | auth/JWT, RBAC, 13 CRUD modules, OpenAPI | `apps/api`                   |
| Telephony service | ARI client, IVR/queue/CDR, NATS events   | `apps/telephony`             |
| Telephony configs | Asterisk, Kamailio, RTPengine, coturn     | `deploy/`                    |
| Deployment        | Dockerfiles + Ansible playbook            | `docker/`, `deploy/ansible/` |
| Database          | 5 migrations, pg client, migrate runner   | `packages/db`                |

See `docs/architecture.md` for the full design and the roadmap.

## Roadmap (MVP → v2)

- **MVP:** auth + 2FA, softphone dialer (WebRTC), contacts, call history,
  voicemail/recordings playback, presence/BLF.
- **v1:** internal chat, SMS/WhatsApp, CRM webhooks, billing.
- **v2:** video meetings, PWA/mobile, desktop app, advanced admin UI.

## License

Proprietary — all rights reserved.
