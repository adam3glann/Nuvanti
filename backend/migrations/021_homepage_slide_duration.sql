ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER NOT NULL DEFAULT 5
    CHECK (duration_seconds BETWEEN 3 AND 30);
