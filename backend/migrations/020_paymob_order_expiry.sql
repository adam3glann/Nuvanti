CREATE INDEX IF NOT EXISTS orders_pending_paymob_expiry_idx
  ON orders (payment_updated_at)
  WHERE payment_method = 'paymob'
    AND payment_status = 'pending'
    AND status = 'pending'
    AND payment_provider_order_id IS NOT NULL;
