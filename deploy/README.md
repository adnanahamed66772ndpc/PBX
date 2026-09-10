# PBX Telephony Stack — deployment configs

Production-ready configs for the telephony engine layer: Asterisk (PJSIP +
ARI + WebRTC), Kamailio (dispatcher + TLS + rtpengine + NAT), RTPengine,
coturn. The call-control brain is the Node service at
[`apps/telephony`](../apps/telephony); these configs make the engines talk to
each other and to the control plane.

## Stack topology

```
SIP/WebRTC UAC  ──TLS:5061──▶  Kamailio  ──dispatcher──▶  Asterisk (5060)
        │  ICE:3478/5349          │            (rtpengine_manage)   │
        ▼                          │                                │
     coturn  ◀── rtp ── rtpengine  │◀── ARI WS:8089 ── @pbx/telephony ◀── apps/api (:5000 HTTP)
                              5060 udp                          ▲
                                                                │ NATS
                                                                ▼
                                                          apps/web (WS)
```

- **Kamailio** (edge) terminates SIP-TLS, authenticates REGISTERs against the
  `extensions` table, dispatches initial requests to the Asterisk cluster
  (`dispatcher.list`), and asks rtpengine to rewrite SDP for NAT.
- **Asterisk** (media + B2BUA) runs PJSIP + the `pbx` Stasis application; the
  Node ARI service subscribes to its WebSocket event stream and drives all
  call control (originate/bridge/IVR/queue).
- **RTPengine** relays RTP between WebRTC (opus/DTLS-SRTP) and SIP (G.711).
- **coturn** provides TURN/STUN for ICE candidate gathering; it is NOT an
  open relay (long-term credentials; no anonymous mode).
- **@pbx/telephony** publishes `TelephonyEvent`s to NATS and writes CDR rows
  to Postgres via `@pbx/db`.

## Port map

| Port        | Protocol | Owner      | Purpose                                  |
|-------------|----------|------------|------------------------------------------|
| 22          | tcp      | host       | SSH / ansible                            |
| 443         | tcp      | nginx      | web UI + metrics scrape (TLS)            |
| 5060        | udp+tcp  | kamailio   | SIP signaling (plain)                    |
| 5061        | tcp      | kamailio   | SIP-TLS signaling                        |
| 3478        | udp      | coturn     | STUN/TURN                                |
| 5349        | tcp      | coturn     | TURN over TLS (TURNS)                    |
| 8088        | tcp      | asterisk   | ARI HTTP                                 |
| 8089        | tcp      | asterisk   | ARI over WebSocket Secure (WSS)          |
| 5000        | tcp      | telephony  | call-control HTTP API (apps/api)        |
| 10000-20000 | udp      | rtpengine/asterisk | RTP media port range            |

> In single-host dev (docker-compose), Kamailio publishes 5060 (edge) and
> Asterisk is internal-only (ARI/WSS/RTP exposed for dev). The Ansible
> playbook opens these exact ranges via ufw.

## envsubst convention

`.conf` files in `deploy/asterisk` and `deploy/kamailio` contain `${VAR}`
placeholders (e.g. `${PUBLIC_HOST}`, `${SIP_DOMAIN}`, `${ARI_USER}`,
`${ARI_PASSWORD}`) because Asterisk/Kamailio config syntax does not do env
expansion natively. Resolution happens in two places:

1. **Docker** — the `docker/{asterisk,kamailio}/entrypoint.sh` runs
   `envsubst` over the `*.conf` / `*.cfg` files **in place** at container
   start, using the container environment (set in `docker-compose.yml`). The
   volume is mounted read-write so the rendered output overwrites the
   template before the engine reads it.
2. **Bare metal / Ansible** — the `playbook.yml` runs `envsubst` at deploy
   time and writes the resolved file directly into `/etc/{asterisk,kamailio}`.

Only the documented variables are passed to `envsubst` (as an allowlist,
`'$VAR:$OTHER'`) so unrelated `$` characters in dialplan/scripts aren't
mangled.

## Directory layout

```
deploy/
├── asterisk/        pjsip.conf, extensions.conf, http.conf, ari.conf,
│                    modules.conf, prometheus.conf, rtp.conf, codecs.conf,
│                    keys/README.md
├── kamailio/        kamailio.cfg, dispatcher.list, tls.cfg,
│                    kamailio-tls-README.md
├── rtpengine/       rtpengine.conf
├── coturn/          turnserver.conf
└── ansible/         inventory.ini, playbook.yml, ansible.cfg
docker/
├── asterisk/        Dockerfile, entrypoint.sh
└── kamailio/        Dockerfile, entrypoint.sh
```

## TLS everywhere

| Plane      | Port | Transport                |
|------------|------|--------------------------|
| SIP signaling | 5061 | TLS (Kamailio `tls.cfg`) |
| ARI        | 8089 | WSS (Asterisk `http.conf` + `pjsip.conf transport-wss`) |
| TURN       | 5349 | TURNS (coturn `turnserver.conf`) |
| Web        | 443  | HTTPS (nginx, Ansible `tls` role) |

Certs are generated per `deploy/asterisk/keys/README.md` and
`deploy/kamailio/kamailio-tls-README.md` (certbot in production; self-signed
for dev). The Ansible `tls` role issues a Let's Encrypt cert and stages the
bundle into each engine's key path, plus a renewal-hook that restarts the
engines on cert rotation.

## Running locally (docker-compose)

```bash
cp .env.example .env   # set PUBLIC_HOST, ARI_PASSWORD, TELEPHONY_TOKEN …
docker compose up -d postgres redis nats asterisk kamailio rtpengine coturn
pnpm --filter @pbx/telephony dev
```

## Provisioning bare metal (Ansible)

```bash
cd deploy/ansible
# edit inventory.ini: set ansible_user, public_host, sip_domain, public_ip,
# and the *_PASSWORD / *_TOKEN vars (ideally vault-encrypted).
ansible-playbook -i inventory.ini playbook.yml
```

The playbook is idempotent: re-running re-renders configs via `envsubst`
and restarts only changed services through handlers. Roles: common
(apt/ufw/fail2ban), postgres, asterisk, kamailio, rtpengine, coturn, tls
(certbot), backup (cron pg_dump + config tarball), monitoring
(node_exporter + nginx scrape proxy).

## Security checklist

- [x] SIP signaling on TLS 5061; plain 5060 only for inter-engine hop.
- [x] ARI on WSS 8089 (TLS), not plain HTTP.
- [x] coturn uses long-term credentials — **not** an open relay
      (`lt-cred-mech` + `user`, no `--no-auth`); private relay space denied.
- [x] Telephony HTTP API gated by a shared-secret `X-Telephony-Token` header.
- [x] UFW denies by default; only the port map above is opened.
- [x] fail2ban jails for sshd + SIP auth.
- [x] Secrets never committed; `.env` + Ansible vault are the source.
