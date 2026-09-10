-- 004_cdr_voicemail.sql
-- Call Detail Records, voicemail, recordings.
CREATE TABLE IF NOT EXISTS call_records (
  id            BIGSERIAL PRIMARY KEY,
  tenant_id     BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_id       VARCHAR(64)  NOT NULL,        -- Asterisk uniqueid
  channel_id    VARCHAR(64),
  from_ext      VARCHAR(32),
  to_ext        VARCHAR(32),
  did           VARCHAR(20),
  direction     VARCHAR(8)   NOT NULL,        -- in|out|internal
  status        VARCHAR(20)  NOT NULL,        -- answered|noanswer|busy|failed
  start_time    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  answer_time   TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  duration_sec  INT          NOT NULL DEFAULT 0,
  billsec       INT          NOT NULL DEFAULT 0,
  disposition   VARCHAR(20),
  recording_url VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_call_records_tenant_time ON call_records (tenant_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_call_id     ON call_records (call_id);

CREATE TABLE IF NOT EXISTS voicemails (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  extension_id BIGINT      REFERENCES extensions(id) ON DELETE CASCADE,
  caller_id   VARCHAR(64),
  duration_sec INT         NOT NULL DEFAULT 0,
  file_path   VARCHAR(255) NOT NULL,
  read        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_voicemails_tenant_ext ON voicemails (tenant_id, extension_id, created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel     VARCHAR(16)  NOT NULL,   -- chat|sms|whatsapp
  from_user_id BIGINT      REFERENCES users(id) ON DELETE CASCADE,
  from_external VARCHAR(64),
  to_user_id   BIGINT      REFERENCES users(id) ON DELETE CASCADE,
  to_external  VARCHAR(64),
  body        TEXT         NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_tenant ON messages (tenant_id, channel, created_at DESC);
