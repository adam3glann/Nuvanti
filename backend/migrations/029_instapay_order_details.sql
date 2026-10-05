-- Preserve the transfer destination shown when an InstaPay order is created,
-- so the customer can retrieve the same instructions from their account later.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS instapay_recipient_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS instapay_whatsapp_phone_snapshot TEXT;
