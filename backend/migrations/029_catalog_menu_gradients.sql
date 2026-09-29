ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_background_end_color TEXT,
  ADD CONSTRAINT categories_menu_background_end_color_check
    CHECK (menu_background_end_color IS NULL OR menu_background_end_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS menu_background_end_color TEXT,
  ADD CONSTRAINT collections_menu_background_end_color_check
    CHECK (menu_background_end_color IS NULL OR menu_background_end_color ~ '^#[0-9A-Fa-f]{6}$');

-- Give the original SUMMER '26 pill the soft green fade shown in the shop reference.
UPDATE collections
SET menu_background_end_color = '#849274'
WHERE slug = 'unisex'
  AND menu_style = 'pill'
  AND menu_background_color = '#35604A'
  AND menu_text_color = '#FFFFFF';
