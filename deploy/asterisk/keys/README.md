# Asterisk TLS keys

Asterisk needs a PEM bundle (certificate + private key) at
`/etc/asterisk/keys/asterisk.pem` for:

- the **WSS transport** in `pjsip.conf` (`transport-wss`, port 8089) used by
  WebRTC SIP clients, and
- the **TLS HTTP server** in `http.conf` (`tlsbindaddr 0.0.0.0:8089`) that
  serves the ARI WebSocket.

**No real certificate is committed to this repo.** Generate one before first
boot using one of the methods below.

## Option A — self-signed via Asterisk's `ast_tls_cert` (fastest, dev only)

Asterisk ships `contrib/scripts/ast_tls_cert` in its source tree. Inside the
`docker/asterisk` image (or a source checkout):

```bash
mkdir -p /etc/asterisk/keys
cd /etc/asterisk/keys
/usr/src/asterisk/contrib/scripts/ast_tls_cert -C pbx.example.com -O "PBX" -d /etc/asterisk/keys
# Produces asterisk.pem (self-signed). Use -C with your PUBLIC_HOST.
```

Self-signed certs are fine for testing WSS; browsers will warn. For
production, use a real CA (Option B).

## Option B — Let's Encrypt via certbot (production)

The Ansible `tls` role runs certbot for `${PUBLIC_HOST}` and stages the certs
into `/etc/asterisk/keys/asterisk.pem` as a concatenated bundle:

```bash
certbot certonly --standalone -d ${PUBLIC_HOST}
cat /etc/letsencrypt/live/${PUBLIC_HOST}/fullchain.pem \
    /etc/letsencrypt/live/${PUBLIC_HOST}/privkey.pem \
  > /etc/asterisk/keys/asterisk.pem
chmod 600 /etc/asterisk/keys/asterisk.pem
```

Reload Asterisk (`asterisk -rx "core restart when convenient"`) after
renewal; the certbot renewal hook in the Ansible `tls` role does this
automatically.

## File layout expected by the configs

```
/etc/asterisk/keys/asterisk.pem   # cert + key bundle, mode 0600
```

The `keys/` directory in this repo intentionally contains only this README —
mount a real generated key at runtime (docker-compose volume, or the Ansible
role) rather than committing secrets.
