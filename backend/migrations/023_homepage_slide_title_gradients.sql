ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS title_gradient_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS title_gradient_start CHAR(7) NOT NULL DEFAULT '#83a88a'
    CHECK (title_gradient_start ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN IF NOT EXISTS title_gradient_end CHAR(7) NOT NULL DEFAULT '#f5f2eb'
    CHECK (title_gradient_end ~ '^#[0-9A-Fa-f]{6}$');
