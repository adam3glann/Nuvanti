-- A random per-order token lets someone with the tracking link check status
-- without logging in (the link is what gets emailed/WhatsApp'd after
-- checkout). It is never guessable from the order id alone.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_idx ON orders (tracking_token) WHERE tracking_token IS NOT NULL;
