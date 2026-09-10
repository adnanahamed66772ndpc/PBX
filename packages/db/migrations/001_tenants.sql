-- 001_tenants.sql
-- Tenants (companies / organizations). Root of all multi-tenant isolation.
CREATE TABLE IF NOT EXISTS tenants (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  domain      VARCHAR(100) UNIQUE,
  plan        VARCHAR(32)  NOT NULL DEFAULT 'free',   -- free|pro|enterprise
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Audit log of all admin/config changes, scoped per tenant.
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    BIGINT,
  action      VARCHAR(64)  NOT NULL,
  entity      VARCHAR(64),
  entity_id   VARCHAR(64),
  payload     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log (tenant_id, created_at DESC);
