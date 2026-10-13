WITH ranked_defaults AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS position
  FROM addresses
  WHERE is_default = TRUE
)
UPDATE addresses AS address
SET is_default = FALSE
FROM ranked_defaults
WHERE address.id = ranked_defaults.id
  AND ranked_defaults.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user_idx
  ON addresses (user_id)
  WHERE is_default = TRUE;
