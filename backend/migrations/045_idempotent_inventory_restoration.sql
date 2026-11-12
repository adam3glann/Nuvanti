ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS inventory_restored_at TIMESTAMPTZ;

-- Earlier cancellation paths already restored inventory before marking an
-- order cancelled. Mark those orders so retries can never add the same stock
-- a second time.
UPDATE orders
SET inventory_restored_at = NOW()
WHERE status = 'cancelled' AND inventory_restored_at IS NULL;
