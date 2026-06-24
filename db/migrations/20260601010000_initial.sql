-- migrate:up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE workflow_run_status AS ENUM (
  'queued',
  'running',
  'waiting',
  'completed',
  'failed',
  'canceled'
);

CREATE TYPE step_attempt_status AS ENUM (
  'started',
  'completed',
  'failed'
);

CREATE TYPE workflow_wait_status AS ENUM (
  'open',
  'resumed',
  'expired',
  'canceled'
);

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_run_id UUID REFERENCES workflow_runs (id) ON DELETE CASCADE,
  definition_name TEXT NOT NULL,
  definition_version INTEGER NOT NULL,
  status workflow_run_status NOT NULL,
  current_step_key TEXT,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error JSONB,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  cancel_requested_at TIMESTAMPTZ,
  cancel_mode TEXT CHECK (cancel_mode IN ('graceful', 'hard')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX workflow_runs_status_created_at_idx
  ON workflow_runs (status, created_at);

CREATE INDEX workflow_runs_lease_expires_at_idx
  ON workflow_runs (lease_expires_at);

CREATE INDEX workflow_runs_available_at_idx
  ON workflow_runs (available_at);

CREATE INDEX workflow_runs_parent_run_id_idx
  ON workflow_runs (parent_run_id);

CREATE TABLE workflow_step_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status step_attempt_status NOT NULL,
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  error JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_key, attempt)
);

CREATE INDEX workflow_step_attempts_run_id_idx
  ON workflow_step_attempts (run_id, step_key, attempt DESC);

CREATE TABLE workflow_waits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  correlation_key TEXT NOT NULL UNIQUE,
  status workflow_wait_status NOT NULL,
  payload JSONB,
  resume_payload JSONB,
  resume_output JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resumed_at TIMESTAMPTZ
);

CREATE INDEX workflow_waits_run_id_idx
  ON workflow_waits (run_id, status);

CREATE TABLE workflow_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
  signal_name TEXT NOT NULL,
  payload JSONB,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workflow_signals_run_id_created_at_idx
  ON workflow_signals (run_id, signal_name, created_at);

CREATE TABLE workflow_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_fire_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workflow_schedules_next_fire_at_idx
  ON workflow_schedules (active, next_fire_at);

CREATE TABLE workflow_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES workflow_runs (id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workflow_outbox_available_at_idx
  ON workflow_outbox (delivered_at, available_at);

CREATE TABLE workflow_events (
  id BIGSERIAL PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
  step_key TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX workflow_events_run_id_idx
  ON workflow_events (run_id, created_at);

COMMENT ON TABLE workflow_runs IS 'Durable execution state for workflow runs';
COMMENT ON TABLE workflow_step_attempts IS 'Per-step execution attempts for audit and recovery';
COMMENT ON TABLE workflow_waits IS 'Open callback waits and their correlation keys';
COMMENT ON TABLE workflow_events IS 'Append-only workflow event stream';
COMMENT ON TABLE workflow_signals IS 'Durable signals delivered to workflow runs';
COMMENT ON TABLE workflow_schedules IS 'Server-side cron schedules that start workflow runs';
COMMENT ON TABLE workflow_outbox IS 'Transactional outbox records for external side effects';

-- migrate:down
DROP TABLE IF EXISTS workflow_outbox;
DROP TABLE IF EXISTS workflow_schedules;
DROP TABLE IF EXISTS workflow_signals;
DROP TABLE IF EXISTS workflow_events;
DROP TABLE IF EXISTS workflow_waits;
DROP TABLE IF EXISTS workflow_step_attempts;
DROP TABLE IF EXISTS workflow_runs;
DROP TYPE IF EXISTS workflow_wait_status;
DROP TYPE IF EXISTS step_attempt_status;
DROP TYPE IF EXISTS workflow_run_status;
