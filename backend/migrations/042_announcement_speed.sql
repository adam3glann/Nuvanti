ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS announcement_speed_seconds INTEGER NOT NULL DEFAULT 26
  CHECK (announcement_speed_seconds BETWEEN 6 AND 60);
