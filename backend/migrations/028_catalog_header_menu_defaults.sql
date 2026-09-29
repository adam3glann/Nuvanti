-- Preserve the existing storefront header links when menu customization is first deployed.
-- Only initialize rows that still have the untouched defaults, so admin styling is retained.
INSERT INTO collections (slug, name)
VALUES
  ('unisex', 'SUMMER ''26'),
  ('mens', 'Men''s Collection'),
  ('womens', 'Women''s Collection')
ON CONFLICT (slug) DO NOTHING;

UPDATE collections
SET menu_show = true,
    menu_label = 'SUMMER ''26',
    menu_style = 'pill',
    menu_background_color = '#35604A',
    menu_text_color = '#FFFFFF'
WHERE slug = 'unisex'
  AND menu_show = false
  AND menu_label IS NULL
  AND menu_style = 'link'
  AND menu_background_color IS NULL
  AND menu_text_color IS NULL;

UPDATE collections
SET menu_show = true
WHERE slug IN ('mens', 'womens')
  AND menu_show = false
  AND menu_label IS NULL
  AND menu_style = 'link'
  AND menu_background_color IS NULL
  AND menu_text_color IS NULL;

-- Shown categories use the familiar green button treatment by default.
-- Admins can switch any item back to a plain link or choose custom colors.
UPDATE categories
SET menu_style = 'pill',
    menu_background_color = COALESCE(menu_background_color, '#35604A'),
    menu_text_color = COALESCE(menu_text_color, '#FFFFFF')
WHERE menu_show = true
  AND menu_style = 'link';
