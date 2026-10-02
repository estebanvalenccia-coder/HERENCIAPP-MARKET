CREATE TABLE IF NOT EXISTS app_storage (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_storage_updated_at_idx ON app_storage(updated_at DESC);


CREATE TABLE IF NOT EXISTS visitor_analytics (
  id bigserial PRIMARY KEY,
  visitor_id text NOT NULL,
  session_id text,
  event_type text NOT NULL DEFAULT 'pageview',
  path text,
  referrer text,
  referrer_host text,
  country text,
  region text,
  city text,
  timezone text,
  language text,
  device text,
  browser text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visitor_analytics_created_at_idx ON visitor_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_analytics_visitor_idx ON visitor_analytics(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS visitor_analytics_event_idx ON visitor_analytics(event_type, created_at DESC);
