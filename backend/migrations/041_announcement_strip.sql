ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS announcement_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS announcement_text TEXT NOT NULL DEFAULT 'Welcome to Nuvanti',
  ADD COLUMN IF NOT EXISTS announcement_background_color TEXT NOT NULL DEFAULT '#17251e',
  ADD COLUMN IF NOT EXISTS announcement_text_color TEXT NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS announcement_pattern TEXT NOT NULL DEFAULT 'stripes',
  ADD COLUMN IF NOT EXISTS announcement_theme TEXT NOT NULL DEFAULT 'midnight';
