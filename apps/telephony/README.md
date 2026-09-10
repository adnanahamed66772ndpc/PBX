# @pbx/telephony

Node TypeScript service that connects to Asterisk's Asterisk REST Interface
(ARI) over HTTP/WebSocket, bridges calls, publishes `TelephonyEvent`s to NATS
(with a no-op fallback when NATS is absent), and exposes a small HTTP control
API used by `apps/api` for originate/hangup.

## Architecture

```
            ┌──────────────┐  ARI WS   ┌────────────┐
 apps/api → │ HTTP control │ ────────► │  Asterisk  │
            │  /originate   │  /ari     │  (PJSIP,    │
            │  /hangup      │           │   Stasis)  │
            └──────┬───────┘           └─────┬──────┘
                   │                           │ stasis events
                   ▼                           ▼
            ┌──────────────┐           ┌──────────────┐
            │ flows/       │ ──CDR───► │ @pbx/db      │
            │  stasis      │           │ call_records │
            │  ivr / queue │           └──────────────┘
            └──────┬───────┘
                   ▼
            ┌──────────────┐
            │ events/      │ ──NATS──► pbx.<tenant>.<category>.<event>
            │  publisher   │           (no-op if NATS_URL unset)
            └──────────────┘
```

- **`src/ari/client.ts`** — ARI client wrapper. Uses only global `fetch` +
  `WebSocket` (undici/Node ≥ 22), no third-party ARI library. REST endpoints
  used are documented at the top of the file.
- **`src/ari/types.ts`** — ARI channel/bridge/event type surface.
- **`src/flows/stasis.handler.ts`** — routes `StasisStart` by tenant + the
  `ext:` / `ivr:` / `queue:` destination grammar (shared with
  `inbound_routes.destination`), finalises CDR on `StasisEnd`/
  `ChannelDestroyed`.
- **`src/flows/ivr.ts`** — plays greeting, collects DTMF via
  `ChannelDtmfReceived`, routes by the `ivrs.menu` JSONB map.
- **`src/flows/queue.ts`** — loads `queue_members` + `extensions` from the
  DB, rings agents round-robin, bridges the caller to the first answer,
  publishes `queue.update`.
- **`src/events/publisher.ts`** — lazy `import('nats')` with a no-op fallback
  so a missing NATS dep or connection never crashes the service.
- **`src/cdr/recorder.ts`** — writes `call_records` rows on `StasisStart`,
  `BridgeEnter` (answer), and `StasisEnd` (finalise, compute duration/billsec).
- **`src/http/server.ts`** — `GET /healthz`, `POST /originate`, `POST /hangup`
  behind a shared-secret `X-Telephony-Token` header.

## Environment

| Var              | Default                | Purpose                                  |
|------------------|------------------------|------------------------------------------|
| `ARI_URL`         | `http://asterisk:8088` | ARI HTTP base (WSS derived from it)       |
| `ARI_USER`        | `asterisk`             | ARI basic-auth user (`ari.conf`)         |
| `ARI_PASSWORD`    | —                      | ARI password (envsubst-injected)         |
| `ARI_APP`         | `pbx`                  | Stasis app name (matches extensions.conf)|
| `NATS_URL`        | —                      | Optional; no-op publisher if unset       |
| `TELEPHONY_PORT`  | `5000`                 | HTTP control API port                    |
| `TELEPHONY_TOKEN` | —                      | Shared secret for `apps/api`            |
| `DATABASE_URL`    | —                      | PostgreSQL (`@pbx/db`)                   |

## Scripts

```bash
pnpm --filter @pbx/telephony dev        # tsx watch
pnpm --filter @pbx/telephony build      # tsc → dist/
pnpm --filter @pbx/telephony start      # node dist/index.js
pnpm --filter @pbx/telephony typecheck  # tsc --noEmit
```

## HTTP API

```http
GET /healthz

POST /originate
X-Telephony-Token: <TELEPHONY_TOKEN>
{ "fromExt": "1001", "to": "1002", "tenantId": 1 }

POST /hangup
X-Telephony-Token: <TELEPHONY_TOKEN>
{ "channelId": "…" }
```

## Why no `node-ari-client`?

The ARI protocol is plain HTTP + JSON-over-WebSocket; using global `fetch` and
the global `WebSocket` keeps the service dependency-free beyond the two
workspace packages, so it boots without `pnpm install` resolving an extra
runtime package and survives npm registry outages.
