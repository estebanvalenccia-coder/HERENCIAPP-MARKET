CREATE TABLE IF NOT EXISTS app_storage (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_storage_updated_at_idx ON app_storage(updated_at DESC);
