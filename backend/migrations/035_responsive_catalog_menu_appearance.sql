ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_desktop_appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_mobile_appearance JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS menu_desktop_appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS menu_mobile_appearance JSONB NOT NULL DEFAULT '{}'::jsonb;
