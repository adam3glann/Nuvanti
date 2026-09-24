CREATE TABLE IF NOT EXISTS deployment_setup (
  setup_key TEXT PRIMARY KEY,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
