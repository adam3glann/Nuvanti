ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS shipping_locations JSONB NOT NULL DEFAULT '[]'::jsonb;
