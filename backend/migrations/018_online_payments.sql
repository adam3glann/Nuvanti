ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_updated_at TIMESTAMPTZ;

UPDATE orders
SET payment_status = CASE WHEN status IN ('paid', 'fulfilled') THEN 'paid' ELSE 'pending' END,
    payment_provider = CASE WHEN payment_method = 'cod' THEN NULL ELSE payment_method END
WHERE payment_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_transaction_id_idx
  ON orders (payment_transaction_id) WHERE payment_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders (payment_status, created_at DESC);
