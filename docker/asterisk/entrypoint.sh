#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# docker/asterisk/entrypoint.sh
# Renders the *.conf.tpl templates into real .conf files using envsubst,
# then execs asterisk in the foreground so the container stays attached.
# Only the vars we actually use are exported to envsubst so unescaped
# dollar signs in dialplan/scripts aren't accidentally mangled.
# ─────────────────────────────────────────────────────────────────────────
set -e

export ARI_USER="${ARI_USER:-asterisk}"
export ARI_PASSWORD="${ARI_PASSWORD:-changeme}"
export PUBLIC_HOST="${PUBLIC_HOST:-pbx.example.com}"

VARS='$ARI_USER:$ARI_PASSWORD:$PUBLIC_HOST'

# Render every .conf file in place: envsubst overwrites the template with
# resolved values so Asterisk reads the final config at startup.
for conf in /etc/asterisk/*.conf; do
    echo "[entrypoint] rendering $(basename "$conf")"
    envsubst "${VARS}" < "$conf" > "${conf}.tmp" && mv "${conf}.tmp" "$conf"
done

echo "[entrypoint] starting asterisk $*"
exec asterisk "$@"
