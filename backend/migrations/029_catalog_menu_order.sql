ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_position INTEGER NOT NULL DEFAULT 2147483647;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS menu_position INTEGER NOT NULL DEFAULT 2147483647;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) * 100 AS position
  FROM categories
)
UPDATE categories AS item SET menu_position = ordered.position
FROM ordered WHERE item.id = ordered.id;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) * 100 AS position
  FROM collections
)
UPDATE collections AS item SET menu_position = ordered.position
FROM ordered WHERE item.id = ordered.id;
