ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS size_advisor_fields JSONB NOT NULL DEFAULT '{"height":{"enabled":true,"label":"Height (cm)","placeholder":"e.g. 168"},"weight":{"enabled":true,"label":"Weight (kg)","placeholder":"e.g. 62"}}'::jsonb;
