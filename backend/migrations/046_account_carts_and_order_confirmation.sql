CREATE TABLE IF NOT EXISTS customer_carts (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reminder_sent_at TIMESTAMPTZ
);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS customer_carts_reminder_idx
  ON customer_carts (updated_at)
  WHERE reminder_sent_at IS NULL;
