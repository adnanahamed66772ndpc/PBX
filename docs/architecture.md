# PBX Platform — Architecture

This document describes the system architecture of the multi-tenant PBX/UC
platform scaffolded in this repository. It is the authoritative reference for
how the three workstreams (frontend, backend, telephony) fit together.

## 1. Two planes

The platform separates a **Control Plane** from a **Telephony Stack**.

```
┌──────────────────────────── Control Plane ────────────────────────────┐
│                                                                         │
│  Browser (Next.js)  ──HTTPS──▶  NestJS API  ──▶  PostgreSQL             │
│         ▲                          │                (source of truth)   │
│         │ WebSocket                │ ARI (HTTP/WS)                      │
│         │ (events)                 ▼                                    │
│    Realtime relay            Telephony Service                          │
│         ▲                          │                                    │
│         │                          ▼                                    │
│      NATS bus  ◀────────  Asterisk ARI events                           │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── Telephony Stack ───────────────────────────┐
│                                                                         │
│  SIP Phone ──SIP──▶  Kamailio (SBC/proxy/dispatcher)  ──▶  Asterisk     │
│  Browser  ──WSS──▶  Kamailio (TLS)                     ──▶  Asterisk     │
│  PSTN     ──SIP trunk──▶ Kamailio                      ──▶  Asterisk     │
│                                                                         │
│  Media:  browser──ICE/TURN──▶ coturn    │  NAT media ──▶ RTPengine      │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Control Plane** (`apps/web`, `apps/api`, `packages/*`): tenant management,
  auth, RBAC, provisioning config, CDR, billing, the web UI, and orchestration
  of Asterisk via the Telephony Service.
- **Telephony Stack** (`apps/telephony`, `deploy/`): Asterisk PBX nodes
  (call engine, IVR, queues, recording), Kamailio (SBC / SIP proxy / load
  balancer), RTPengine (media relay / NAT), coturn (WebRTC TURN/STUN).

## 2. Components

### 2.1 Frontend — `apps/web` (Next.js 14, App Router)

- Design tokens (CSS variables) per the style guide; semantic roles
  (brand/accent/danger/neutral); dark mode via `.dark` class.
- Reusable component library: `Button`, `Input`, `Table`, `Badge`, `Card`,
  `Modal`, `Sidebar`, `Topbar`.
- Key pages: login, dashboard, softphone dialer, contacts, call history,
  voicemail. The dialer is the WebRTC softphone surface (JSSIP integration
  placeholder).
- Talks to the API over REST (`lib/api.ts`) and receives realtime events over
  WebSocket from the realtime relay.

### 2.2 Backend — `apps/api` (NestJS)

Modular monolith with the following modules:

| Module          | Responsibility                                          |
|-----------------|---------------------------------------------------------|
| `auth`          | JWT access + refresh tokens, bcrypt, TOTP 2FA, register |
| `tenants`       | Tenant CRUD (owner/admin)                               |
| `users`         | User CRUD within tenant, RBAC roles                     |
| `extensions`    | SIP extension provisioning (generates secret)           |
| `trunks`        | SIP trunk CRUD                                          |
| `inbound-routes`| DID → destination routing rules                         |
| `dids`          | DID number management + route assignment                |
| `queues`        | Call queues + members                                   |
| `ivrs`          | IVR definitions (JSONB menu)                            |
| `cdr`           | Call detail records (read-only, filtered, paginated)    |
| `call-control`  | Originate/hangup via the Telephony Service (ARI)        |
| `events`        | Publishes `TelephonyEvent` to NATS                      |

Cross-cutting:

- **Tenancy isolation**: a request-scoped `TenantContext` holds the caller's
  `tenant_id` (from the JWT). Every DB query goes through `scopedQuery()`
  which injects `tenant_id` server-side — client-supplied tenant values are
  never trusted.
- **RBAC**: `@Roles()` decorator + `RolesGuard`; roles are
  `owner | admin | manager | agent | user`.
- **OpenAPI**: Swagger UI at `/docs`; static spec in `apps/api/swagger/`.

### 2.3 Telephony Service — `apps/telephony` (Node)

Connects to Asterisk ARI (HTTP + WebSocket), implements the Stasis app
(`pbx`), handles IVR digit collection and queue ring strategy, records CDR
rows into PostgreSQL, and publishes `TelephonyEvent`s onto NATS. Exposes a
small HTTP API (`POST /originate`, `POST /hangup`, `GET /healthz`) that the
API's `call-control` module calls.

### 2.4 Shared packages

- `@pbx/db` — `pg` pool (`getDb`, `tx`), the migration runner, and the domain
  type definitions mirroring the SQL schema.
- `@pbx/common` — structured `createLogger`, `AppError`/`Errors`, and the
  `TelephonyEvent` contract + `subjectFor` helper for NATS subjects.

## 3. Data model

Five migrations in `packages/db/migrations`:

1. `001_tenants` — tenants + audit log
2. `002_users_roles` — users, refresh tokens, departments
3. `003_telephony_config` — extensions, trunks, inbound routes, DIDs, IVRs,
   queues + members
4. `004_cdr_voicemail` — call records, voicemail, messages (chat/SMS/WhatsApp)
5. `005_billing` — rate cards, subscriptions, invoices

Every tenant-scoped table carries `tenant_id BIGINT REFERENCES tenants(id)`
and cascades on tenant deletion. Composite unique constraints are scoped
(`UNIQUE (tenant_id, ext_number)`, `UNIQUE (tenant_id, email)`).

## 4. Event flow

```
Asterisk ARI  ──WS events──▶  Telephony Service
                                   │
                                   ├── writes CDR row (PostgreSQL)
                                   └── publishes TelephonyEvent (NATS)
                                          │
                            subject pbx.<tenant>.<cat>.<event>
                                          │
                                          ▼
                                   Realtime relay ──WebSocket──▶ Browser
```

User-initiated originate:

```
Browser ──POST /calls/originate──▶ API (call-control)
   ──POST /originate──▶ Telephony Service ──ARI POST /ari/channels──▶ Asterisk
```

## 5. Telephony architecture

- **Kamailio** is the single SIP ingress: terminates TLS (5061), dispatches
  to Asterisk nodes via the `dispatcher` module (user-hash algorithm keeps an
  extension on a consistent node for BLF/parking), rewrites SDP for NAT via
  `rtpengine_manage()`.
- **Asterisk** runs PJSIP with WSS transport for WebRTC endpoints
  (`webrtc=yes` ⇒ ICE, DTLS-SRTP, RTCP mux) plus UDP for LAN phones. The
  Stasis app `pbx` hands channels to the Telephony Service.
- **RTPengine** relays media when either leg is behind NAT or transcoding is
  needed.
- **coturn** provides TURN/STUN so WebRTC softphones reach media behind
  symmetric NAT; configured with TLS and long-term credentials (never an open
  relay).

See `deploy/README.md` for the port map and the envsubst convention used to
inject `PUBLIC_HOST` / `SIP_DOMAIN` / `ARI_PASSWORD` into the engine configs.

## 6. Security

- TLS everywhere: HTTPS (443) for web, SIP-TLS (5061), TURNS (5349), ARI WSS
  (8089). Certs via Let's Encrypt (Ansible `tls` role).
- API auth: JWT (short-lived access + rotating refresh), bcrypt password
  hashing, optional TOTP 2FA for admins. RBAC + per-tenant isolation.
- Edge: `ufw` allowlist, `fail2ban` for SIP brute-force, Kamailio ACLs.
- Audit log records all admin/config mutations per tenant.

## 7. Observability & operations

- Prometheus: Asterisk built-in exporter at `:8088/metrics`, Node exporters
  for the API/telephony service, Grafana dashboards (call volume, SIP errors,
  CPU, call failure rate).
- Structured JSON logs from `@pbx/common`'s logger.
- Backups: cron `pg_dump` of PostgreSQL + Asterisk config tarball.
- HA: at least two Asterisk nodes active/active behind Kamailio dispatcher;
  PostgreSQL replication; Kamailio edge can be horizontally scaled.

## 8. Deployment

- Local dev: `docker compose up -d postgres redis nats` then `pnpm dev:*`.
- Single VPS: the Ansible playbook in `deploy/ansible/` provisions a full
  Ubuntu 24.04 node — OS hardening, firewall, Postgres, Asterisk, Kamailio,
  RTPengine, coturn, TLS certs, backups, monitoring.
- Scale-out: run the same roles across multiple hosts; Kamailio dispatcher
  load-balances Asterisk; the control plane moves to Kubernetes with Helm
  (future).
