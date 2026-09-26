ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS text_color CHAR(7) NOT NULL DEFAULT '#f5f2eb'
    CHECK (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS eyebrow_color CHAR(7)
    CHECK (eyebrow_color IS NULL OR eyebrow_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS title_color CHAR(7)
    CHECK (title_color IS NULL OR title_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS description_color CHAR(7)
    CHECK (description_color IS NULL OR description_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS button_text_color CHAR(7)
    CHECK (button_text_color IS NULL OR button_text_color ~ '^#[0-9A-Fa-f]{6}$');
