-- 003_telephony_config.sql
-- Extensions, devices, SIP trunks, DIDs, inbound routes, IVRs, queues.
CREATE TABLE IF NOT EXISTS extensions (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     BIGINT       REFERENCES users(id) ON DELETE SET NULL,
  ext_number  VARCHAR(10)  NOT NULL,
  secret      VARCHAR(100) NOT NULL,
  caller_id   VARCHAR(100),
  context     VARCHAR(64)  NOT NULL DEFAULT 'default',
  webrtc      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ext_number)
);

CREATE TABLE IF NOT EXISTS sip_trunks (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  hostname    VARCHAR(255) NOT NULL,
  port        INT          NOT NULL DEFAULT 5060,
  transport   VARCHAR(8)   NOT NULL DEFAULT 'udp', -- udp|tcp|tls
  username    VARCHAR(100),
  password    VARCHAR(100),
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbound_routes (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  description TEXT,
  destination VARCHAR(255) NOT NULL,  -- e.g. ivr:main, queue:sales, ext:1001
  priority    INT          NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS did_numbers (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number            VARCHAR(20) NOT NULL UNIQUE,
  inbound_route_id  BIGINT       REFERENCES inbound_routes(id) ON DELETE SET NULL,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ivrs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  greeting    VARCHAR(255),                 -- sound file path or tts text
  menu        JSONB         NOT NULL DEFAULT '[]'::jsonb, -- [{digit,destination}]
  timeout     INT           NOT NULL DEFAULT 5,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queues (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(120) NOT NULL,
  strategy      VARCHAR(32)  NOT NULL DEFAULT 'ringall', -- ringall|roundrobin|leastrecent|fewestcalls
  timeout       INT          NOT NULL DEFAULT 30,
  wrapup_time   INT          NOT NULL DEFAULT 5,
  max_callers   INT          NOT NULL DEFAULT 0,         -- 0 = unlimited
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS queue_members (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue_id    BIGINT  NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
  extension_id BIGINT NOT NULL REFERENCES extensions(id) ON DELETE CASCADE,
  penalty     INT     NOT NULL DEFAULT 0,
  paused      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, queue_id, extension_id)
);
