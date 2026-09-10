-- 005_billing.sql
-- Subscriptions, rate cards, usage / invoicing.
CREATE TABLE IF NOT EXISTS rate_cards (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefix      VARCHAR(16)  NOT NULL,        -- e.g. 1, 44, 33
  rate        NUMERIC(10,4) NOT NULL,       -- per minute
  currency    VARCHAR(3)   NOT NULL DEFAULT 'USD',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_cards_tenant_prefix ON rate_cards (tenant_id, prefix);

CREATE TABLE IF NOT EXISTS subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan        VARCHAR(32)  NOT NULL,        -- free|pro|enterprise
  seat_count  INT          NOT NULL DEFAULT 1,
  status      VARCHAR(16)  NOT NULL DEFAULT 'active',
  period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_end  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   BIGINT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id BIGINT   REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount      NUMERIC(12,2) NOT NULL,
  currency    VARCHAR(3)   NOT NULL DEFAULT 'USD',
  status      VARCHAR(16)  NOT NULL DEFAULT 'draft', -- draft|open|paid|void
  issued_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  due_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices (tenant_id, issued_at DESC);
