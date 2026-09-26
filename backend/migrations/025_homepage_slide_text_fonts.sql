ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS text_fonts JSONB NOT NULL DEFAULT '{"all":{"enabled":false,"font":"display"},"eyebrow":"inherit","title":"inherit","description":"inherit","button":"inherit"}'::jsonb;
