-- 002_users_roles.sql
-- Users (employees / agents / admins) and RBAC.
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  tenant_id       BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           VARCHAR(255) NOT NULL,
  password_hash   TEXT         NOT NULL,
  full_name       VARCHAR(255),
  role            VARCHAR(32)  NOT NULL DEFAULT 'user',  -- owner|admin|manager|agent|user
  presence        VARCHAR(16)  NOT NULL DEFAULT 'available', -- available|away|dnd|offline
  totp_secret     TEXT,
  active          BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- Email is globally unique: each user belongs to exactly one tenant, and
  -- the login flow (POST /auth/login) resolves the user by email alone, so
  -- duplicate emails across tenants would be ambiguous.
  UNIQUE (email)
);

-- Refresh tokens for JWT rotation.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Departments (for grouping extensions / queue membership).
CREATE TABLE IF NOT EXISTS departments (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
