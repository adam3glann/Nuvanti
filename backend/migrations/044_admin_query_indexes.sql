-- Support the customer/order/analytics access paths used by the admin API.
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON order_items (order_id);

CREATE INDEX IF NOT EXISTS addresses_user_phone_preference_idx
  ON addresses (user_id, is_default DESC, created_at DESC, id DESC)
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

CREATE INDEX IF NOT EXISTS orders_customer_phone_latest_idx
  ON orders (user_id, created_at DESC, id DESC)
  WHERE user_id IS NOT NULL
    AND nullif(btrim(shipping_address->>'phone'), '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_guest_email_lookup_idx
  ON orders ((lower(btrim(shipping_address->>'email'))), created_at DESC)
  WHERE user_id IS NULL AND nullif(btrim(shipping_address->>'email'), '') IS NOT NULL;
