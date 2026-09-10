# ─────────────────────────────────────────────────────────────────────────
# docker/kamailio/Dockerfile
# Kamailio + the modules referenced in kamailio.cfg (tls, dispatcher,
# rtpengine, nathelper, db_postgres, auth_db). Configs from deploy/kamailio
# are COPY'd as templates and envsubst'd at start by the entrypoint.
# ─────────────────────────────────────────────────────────────────────────
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PUBLIC_HOST=pbx.example.com \
    SIP_DOMAIN=pbx.example.com \
    PUBLIC_IP=0.0.0.0 \
    KAM_DB_USER=pbx \
    KAM_DB_PASSWORD=change_me \
    POSTGRES_DB=pbx

# Install Kamailio from the official kamailio repo (current major) so we get
# recent modules, plus the DB drivers and the modules we load in kamailio.cfg.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gnupg ca-certificates wget \
    && wget -O /etc/apt/keyrings/kamailio.key \
        https://deb.kamailio.org/kamailiodebkey.gpg 2>/dev/null || true \
    && echo "deb [signed-by=/etc/apt/keyrings/kamailio.key] http://deb.kamailio.org/kamailio62 bookworm main" \
        > /etc/apt/sources.list.d/kamailio.list \
    && apt-get update && apt-get install -y --no-install-recommends \
        kamailio \
        kamailio-tls-modules \
        kamailio-dispatcher-modules \
        kamailio-nth-modules \
        kamailio-rtpengine-modules \
        kamailio-postgres-modules \
        kamailio-utils-modules \
        kamailio-geoip-modules \
        kamailio-xml-modules \
        gettext-base \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Stash the stock config; mount our own under /etc/kamailio.
RUN mv /etc/kamailio /etc/kamailio.stock
RUN mkdir -p /etc/kamailio/tls

# Copy configs as-is (templates with ${} placeholders). The entrypoint
# renders them in-place via envsubst before Kamailio reads them.
COPY deploy/kamailio/              /etc/kamailio/

# Dev cert fallback; production mounts a real bundle (see README).
RUN if [ ! -f /etc/kamailio/tls/kamailio.pem ]; then \
        openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
          -keyout /etc/kamailio/tls/kamailio.pem \
          -out    /etc/kamailio/tls/kamailio.pem \
          -subj "/CN=${SIP_DOMAIN}" 2>/dev/null || true; \
    fi && chmod 600 /etc/kamailio/tls/kamailio.pem \
    && cp /etc/kamailio/tls/kamailio.pem /etc/kamailio/tls/cacert.pem || true

COPY docker/kamailio/entrypoint.sh /usr/local/bin/kamailio-entrypoint.sh
RUN chmod +x /usr/local/bin/kamailio-entrypoint.sh

EXPOSE 5060/udp 5060/tcp 5061/tcp

USER kamailio
ENTRYPOINT ["/usr/local/bin/kamailio-entrypoint.sh"]
CMD ["-P /run/kamailio/kamailio.pid -f /etc/kamailio/kamailio.cfg"]
