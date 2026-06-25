-- migrate:up
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS branched_from_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_by_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workflow_runs_branched_from_run_id_idx
  ON workflow_runs (branched_from_run_id);

CREATE INDEX IF NOT EXISTS workflow_runs_superseded_by_run_id_idx
  ON workflow_runs (superseded_by_run_id);

ALTER TABLE workflow_step_attempts
  ADD COLUMN IF NOT EXISTS step_seq INTEGER,
  ADD COLUMN IF NOT EXISTS context_before JSONB NOT NULL DEFAULT '{}'::jsonb;

WITH sequenced_attempts AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY run_id
      ORDER BY created_at ASC, attempt ASC, id ASC
    )::int AS step_seq
  FROM workflow_step_attempts
)
UPDATE workflow_step_attempts AS attempts
SET step_seq = sequenced_attempts.step_seq
FROM sequenced_attempts
WHERE attempts.id = sequenced_attempts.id;

ALTER TABLE workflow_step_attempts
  ALTER COLUMN step_seq SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_step_attempts_run_id_step_seq_idx
  ON workflow_step_attempts (run_id, step_seq);

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS branched_from_attempt_id UUID REFERENCES workflow_step_attempts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workflow_runs_branched_from_attempt_id_idx
  ON workflow_runs (branched_from_attempt_id);

-- migrate:down
DROP INDEX IF EXISTS workflow_runs_branched_from_attempt_id_idx;

ALTER TABLE workflow_runs
  DROP COLUMN IF EXISTS branched_from_attempt_id;

DROP INDEX IF EXISTS workflow_step_attempts_run_id_step_seq_idx;

ALTER TABLE workflow_step_attempts
  DROP COLUMN IF EXISTS context_before,
  DROP COLUMN IF EXISTS step_seq;

DROP INDEX IF EXISTS workflow_runs_superseded_by_run_id_idx;
DROP INDEX IF EXISTS workflow_runs_branched_from_run_id_idx;

ALTER TABLE workflow_runs
  DROP COLUMN IF EXISTS superseded_by_run_id,
  DROP COLUMN IF EXISTS branched_from_run_id;
