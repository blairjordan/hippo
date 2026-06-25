-- migrate:up
ALTER TYPE workflow_run_status ADD VALUE IF NOT EXISTS 'compensation_failed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'step_attempt_kind'
  ) THEN
    CREATE TYPE step_attempt_kind AS ENUM ('forward', 'compensate');
  END IF;
END
$$;

ALTER TABLE workflow_step_attempts
  ADD COLUMN IF NOT EXISTS kind step_attempt_kind NOT NULL DEFAULT 'forward';

ALTER TABLE workflow_step_attempts
  DROP CONSTRAINT IF EXISTS workflow_step_attempts_run_id_step_key_attempt_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workflow_step_attempts_run_id_step_key_kind_attempt_key'
  ) THEN
    ALTER TABLE workflow_step_attempts
      ADD CONSTRAINT workflow_step_attempts_run_id_step_key_kind_attempt_key
      UNIQUE (run_id, step_key, kind, attempt);
  END IF;
END
$$;

DROP INDEX IF EXISTS workflow_step_attempts_run_id_idx;

CREATE INDEX IF NOT EXISTS workflow_step_attempts_run_id_idx
  ON workflow_step_attempts (run_id, step_key, kind, attempt DESC);

-- migrate:down
DROP INDEX IF EXISTS workflow_step_attempts_run_id_idx;

CREATE INDEX workflow_step_attempts_run_id_idx
  ON workflow_step_attempts (run_id, step_key, attempt DESC);

ALTER TABLE workflow_step_attempts
  DROP CONSTRAINT IF EXISTS workflow_step_attempts_run_id_step_key_kind_attempt_key;

ALTER TABLE workflow_step_attempts
  ADD CONSTRAINT workflow_step_attempts_run_id_step_key_attempt_key
  UNIQUE (run_id, step_key, attempt);

ALTER TABLE workflow_step_attempts
  DROP COLUMN IF EXISTS kind;

DROP TYPE IF EXISTS step_attempt_kind;
