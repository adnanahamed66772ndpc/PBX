# Kamailio TLS certificates

Kamailio terminates SIP-TLS on port **5061** (see `kamailio.cfg` listener +
`tls.cfg`). It needs a PEM bundle at `/etc/kamailio/tls/kamailio.pem`.

**No real certificate is committed.** Generate one before first boot.

## Self-signed (dev)

```bash
mkdir -p /etc/kamailio/tls
openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout /etc/kamailio/tls/kamailio.pem \
  -out    /etc/kamailio/tls/kamailio.pem \
  -subj   "/CN=${SIP_DOMAIN}" \
  -addext "subjectAltName=DNS:${SIP_DOMAIN}"
chmod 600 /etc/kamailio/tls/kamailio.pem
cp /etc/kamailio/tls/kamailio.pem /etc/kamailio/tls/cacert.pem
```

## Let's Encrypt (production)

The Ansible `tls` role runs certbot for `${SIP_DOMAIN}` / `${PUBLIC_HOST}`
and stages the bundle:

```bash
certbot certonly --standalone -d ${SIP_DOMAIN}
cat /etc/letsencrypt/live/${SIP_DOMAIN}/fullchain.pem \
    /etc/letsencrypt/live/${SIP_DOMAIN}/privkey.pem \
  > /etc/kamailio/tls/kamailio.pem
cp /etc/letsencrypt/live/${SIP_DOMAIN}/chain.pem /etc/kamailio/tls/cacert.pem
chmod 600 /etc/kamailio/tls/kamailio.pem
```

## Expected layout

```
/etc/kamailio/tls/kamailio.pem   # cert + key bundle, mode 0600
/etc/kamailio/tls/cacert.pem     # CA chain for client verification
```

Reload Kamailio after renewal: `kamctl rpc tls.reload` (wired into the
certbot renewal hook by the Ansible `tls` role).
