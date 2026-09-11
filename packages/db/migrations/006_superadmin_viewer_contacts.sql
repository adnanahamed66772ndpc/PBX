-- 006_superadmin_viewer_contacts.sql
-- 1) Allow superadmin users to exist without a tenant (tenant_id nullable).
ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;

-- 2) Contacts directory — tenant-scoped address book.
CREATE TABLE IF NOT EXISTS contacts (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name   VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(64)  NOT NULL,
  extension   VARCHAR(32),
  department  VARCHAR(120),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts (tenant_id, full_name);
