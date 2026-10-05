-- Keep this follow-up migration separate from 027 so deployments that already
-- recorded the original InstaPay migration still receive the finalized schema.
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS instapay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS instapay_recipient TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS instapay_whatsapp_phone TEXT NOT NULL DEFAULT '';

ALTER TABLE store_settings
  ALTER COLUMN instapay_enabled SET DEFAULT FALSE,
  ALTER COLUMN instapay_recipient SET DEFAULT '',
  ALTER COLUMN instapay_whatsapp_phone SET DEFAULT '';
