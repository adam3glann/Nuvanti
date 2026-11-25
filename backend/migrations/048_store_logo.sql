ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT NOT NULL DEFAULT 'assets/img/brand/NUVANTI Star Logo.png';
