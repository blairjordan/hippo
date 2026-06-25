-- migrate:up
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS task_queue TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS workflow_runs_task_queue_priority_available_at_idx
  ON workflow_runs (task_queue, priority DESC, available_at, created_at);

ALTER TABLE workflow_schedules
  ADD COLUMN IF NOT EXISTS task_queue TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

-- migrate:down
ALTER TABLE workflow_schedules
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS task_queue;

DROP INDEX IF EXISTS workflow_runs_task_queue_priority_available_at_idx;

ALTER TABLE workflow_runs
  DROP COLUMN IF EXISTS priority,
  DROP COLUMN IF EXISTS task_queue;
