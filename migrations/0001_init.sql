CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE watcher_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payload_hash BYTEA NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'dashboard',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  hashrate_mh NUMERIC(18,3) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('online', 'offline', 'inactive'))
);

CREATE INDEX IF NOT EXISTS workers_user_id_idx ON workers (user_id);

