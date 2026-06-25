-- migrate:up
ALTER TABLE workflow_runs
  ADD COLUMN continued_from_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL;

CREATE INDEX workflow_runs_continued_from_run_id_idx
  ON workflow_runs (continued_from_run_id);

-- migrate:down
DROP INDEX IF EXISTS workflow_runs_continued_from_run_id_idx;

ALTER TABLE workflow_runs
  DROP COLUMN IF EXISTS continued_from_run_id;
