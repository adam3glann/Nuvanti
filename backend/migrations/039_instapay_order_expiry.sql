CREATE INDEX IF NOT EXISTS orders_pending_instapay_expiry_idx
  ON orders (created_at)
  WHERE payment_method = 'instapay'
    AND payment_status = 'pending'
    AND status = 'pending';
