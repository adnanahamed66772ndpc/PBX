#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# docker/kamailio/entrypoint.sh
# Renders *.tpl configs via envsubst, then execs kamailio in the foreground.
# ─────────────────────────────────────────────────────────────────────────
set -e

export PUBLIC_HOST="${PUBLIC_HOST:-pbx.example.com}"
export SIP_DOMAIN="${SIP_DOMAIN:-pbx.example.com}"
export PUBLIC_IP="${PUBLIC_IP:-0.0.0.0}"
export KAM_DB_USER="${KAM_DB_USER:-pbx}"
export KAM_DB_PASSWORD="${KAM_DB_PASSWORD:-change_me}"
export POSTGRES_DB="${POSTGRES_DB:-pbx}"
export RTPE_HOST="${RTPE_HOST:-rtpengine}"

VARS='$PUBLIC_HOST:$SIP_DOMAIN:$PUBLIC_IP:$KAM_DB_USER:$KAM_DB_PASSWORD:$POSTGRES_DB:$RTPE_HOST'

# Render every config file in place: envsubst overwrites templates with
# resolved values so Kamailio reads the final config at startup.
for conf in /etc/kamailio/*.cfg /etc/kamailio/*.list; do
    [ -f "$conf" ] || continue
    echo "[entrypoint] rendering $(basename "$conf")"
    envsubst "${VARS}" < "$conf" > "${conf}.tmp" && mv "${conf}.tmp" "$conf"
done

echo "[entrypoint] starting kamailio $*"
exec kamailio "$@"
