CREATE TABLE IF NOT EXISTS emergency_lockdown (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  activated_at TIMESTAMPTZ,
  activated_by BIGINT REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO emergency_lockdown (id, is_active)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;
