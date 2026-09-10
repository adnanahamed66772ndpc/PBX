# ─────────────────────────────────────────────────────────────────────────
# docker/asterisk/Dockerfile
# Asterisk + ARI/PJSIP/WebRTC modules. Configs from deploy/asterisk contain
# ${VAR} placeholders and are envsubst'd in-place at container start by
# the entrypoint (docker/asterisk/entrypoint.sh).
# In docker-compose, deploy/asterisk is volume-mounted over /etc/asterisk,
# so these COPYs only apply to standalone `docker build` usage.
# ─────────────────────────────────────────────────────────────────────────
FROM debian:12-slim

ARG ASTERISK_VERSION=20.9.0

ENV DEBIAN_FRONTEND=noninteractive \
    ARI_USER=asterisk \
    ARI_PASSWORD=changeme \
    PUBLIC_HOST=pbx.example.com

# Build dependencies + runtime. Asterisk 20 is in debian-bookworm; if the
# packaged version is insufficient, build from source via the commented block.
RUN apt-get update && apt-get install -y --no-install-recommends \
        asterisk \
        asterisk-config \
        asterisk-dahdi \
        asterisk-mobile \
        asterisk-modules \
        asterisk-mp3 \
        asterisk-mysql \
        asterisk-ooh323 \
        asterisk-voicemail \
        gettext-base \
        ca-certificates \
        ssl-cert \
        libsrtp2-1 \
    && rm -rf /var/lib/apt/lists/*

# Stash the stock config aside; we mount our own under /etc/asterisk.
RUN mv /etc/asterisk /etc/asterisk.stock

# Copy configs as-is (templates with ${} placeholders). The entrypoint
# renders them in-place via envsubst before Asterisk reads them.
COPY deploy/asterisk/              /etc/asterisk/

# Generate a self-signed cert on first start if none is present (dev only).
# Production mounts a real cert via a volume (see deploy/asterisk/keys/README.md).
RUN mkdir -p /etc/asterisk/keys && \
    if [ ! -f /etc/asterisk/keys/asterisk.pem ]; then \
        openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
            -keyout /etc/asterisk/keys/asterisk.pem \
            -out    /etc/asterisk/keys/asterisk.pem \
            -subj "/CN=${PUBLIC_HOST}" 2>/dev/null || true; \
    fi && chmod 600 /etc/asterisk/keys/asterisk.pem

# Spool dirs.
RUN mkdir -p /var/spool/asterisk/recording /var/spool/asterisk/voicemail \
    && chown -R asterisk:asterisk /var/spool/asterisk

# ── Entrypoint: envsubst .conf in-place, then exec asterisk ───────────────
COPY docker/asterisk/entrypoint.sh /usr/local/bin/asterisk-entrypoint.sh
RUN chmod +x /usr/local/bin/asterisk-entrypoint.sh

EXPOSE 5060/udp 5060/tcp 5061/tcp 8088/tcp 8089/tcp 10000-20000/udp

USER asterisk
ENTRYPOINT ["/usr/local/bin/asterisk-entrypoint.sh"]
CMD ["-f", "-vvvc"]
