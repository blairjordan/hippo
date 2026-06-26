/* @name InsertRun */
INSERT INTO workflow_runs (
  parent_run_id,
  parent_step_key,
  definition_name,
  definition_version,
  task_queue,
  priority,
  status,
  current_step_key,
  idempotency_key,
  input,
  context
) VALUES (
  :parentRunId,
  :parentStepKey,
  :definitionName,
  :definitionVersion,
  :taskQueue,
  :priority,
  'queued',
  :currentStepKey,
  :idempotencyKey,
  :input,
  '{}'::jsonb
)
ON CONFLICT (definition_name, idempotency_key)
DO UPDATE SET
  idempotency_key = workflow_runs.idempotency_key
RETURNING
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt";

/* @name GetRunById */
SELECT
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE id = :runId;

/* @name GetRunEvents */
SELECT
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  event_type AS "eventType",
  payload,
  created_at AS "createdAt"
FROM workflow_events
WHERE run_id = :runId
ORDER BY created_at ASC, id ASC;

/* @name GetRunAttempts */
SELECT
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  kind,
  step_seq AS "stepSeq",
  attempt,
  status,
  context_before AS "contextBefore",
  input,
  output,
  error,
  started_at AS "startedAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM workflow_step_attempts
WHERE run_id = :runId
ORDER BY step_seq ASC, attempt ASC, created_at ASC;

/* @name InsertEvent */
INSERT INTO workflow_events (
  run_id,
  step_key,
  event_type,
  payload
) VALUES (
  :runId,
  :stepKey,
  :eventType,
  :payload
)
RETURNING
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  event_type AS "eventType",
  payload,
  created_at AS "createdAt";

/* @name ClaimNextRunnableRun */
WITH candidate AS (
  SELECT id
  FROM workflow_runs
  WHERE status IN ('queued', 'running')
    AND task_queue = ANY(:taskQueues)
    AND current_step_key IS NOT NULL
    AND available_at <= now()
    AND (lease_expires_at IS NULL OR lease_expires_at < now())
  ORDER BY priority DESC, available_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE workflow_runs AS runs
SET
  status = 'running',
  lease_owner = :workerId,
  lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
  updated_at = now()
FROM candidate
WHERE runs.id = candidate.id
RETURNING
  runs.id,
  runs.parent_run_id AS "parentRunId",
  runs.parent_step_key AS "parentStepKey",
  runs.continued_from_run_id AS "continuedFromRunId",
  runs.branched_from_run_id AS "branchedFromRunId",
  runs.branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  runs.branched_from_attempt_id AS "branchedFromAttemptId",
  runs.superseded_by_run_id AS "supersededByRunId",
  runs.definition_name AS "definitionName",
  runs.definition_version AS "definitionVersion",
  runs.task_queue AS "taskQueue",
  runs.priority,
  runs.status,
  runs.current_step_key AS "currentStepKey",
  runs.input,
  runs.context,
  runs.result,
  runs.error,
  runs.lease_owner AS "leaseOwner",
  runs.lease_expires_at AS "leaseExpiresAt",
  runs.available_at AS "availableAt",
  runs.created_at AS "createdAt",
  runs.updated_at AS "updatedAt",
  runs.completed_at AS "completedAt";

/* @name GetLastStepAttempt */
SELECT COALESCE(MAX(attempt), 0)::int AS "lastAttempt"
FROM workflow_step_attempts
WHERE run_id = :runId
  AND step_key = :stepKey
  AND kind = :kind;

/* @name GetLastStepSequence */
SELECT COALESCE(MAX(step_seq), 0)::int AS "lastStepSeq"
FROM workflow_step_attempts
WHERE run_id = :runId;

/* @name InsertStepAttempt */
INSERT INTO workflow_step_attempts (
  run_id,
  step_key,
  kind,
  step_seq,
  attempt,
  status,
  context_before,
  input
) VALUES (
  :runId,
  :stepKey,
  :kind,
  :stepSeq,
  :attempt,
  'started',
  :contextBefore,
  :input
)
RETURNING
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  kind,
  step_seq AS "stepSeq",
  attempt,
  status,
  context_before AS "contextBefore",
  input,
  output,
  error,
  started_at AS "startedAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name GetStepAttemptByIdForRun */
SELECT
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  kind,
  step_seq AS "stepSeq",
  attempt,
  status,
  context_before AS "contextBefore",
  input,
  output,
  error,
  started_at AS "startedAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM workflow_step_attempts
WHERE run_id = :runId
  AND id = :attemptId;

/* @name InsertBranchedRun */
INSERT INTO workflow_runs (
  branched_from_run_id,
  branched_from_attempt_run_id,
  branched_from_attempt_id,
  definition_name,
  definition_version,
  task_queue,
  priority,
  status,
  current_step_key,
  input,
  context
) VALUES (
  :branchedFromRunId,
  :branchedFromAttemptRunId,
  :branchedFromAttemptId,
  :definitionName,
  :definitionVersion,
  :taskQueue,
  :priority,
  'queued',
  :currentStepKey,
  :input,
  :context
)
RETURNING
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt";

/* @name MarkRunSuperseded */
UPDATE workflow_runs
SET
  superseded_by_run_id = :supersededByRunId,
  updated_at = now()
WHERE id = :runId
  AND superseded_by_run_id IS NULL
RETURNING
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt";

/* @name CompleteStandaloneStepAttempt */
UPDATE workflow_step_attempts
SET
  status = 'completed',
  output = :output,
  error = NULL,
  completed_at = now(),
  updated_at = now()
WHERE run_id = :runId
  AND id = :attemptId
RETURNING
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  kind,
  attempt,
  status,
  input,
  output,
  error,
  started_at AS "startedAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name FailStandaloneStepAttempt */
UPDATE workflow_step_attempts
SET
  status = 'failed',
  output = NULL,
  error = :error,
  completed_at = now(),
  updated_at = now()
WHERE run_id = :runId
  AND id = :attemptId
RETURNING
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  kind,
  attempt,
  status,
  input,
  output,
  error,
  started_at AS "startedAt",
  last_heartbeat_at AS "lastHeartbeatAt",
  completed_at AS "completedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name MarkRunCompensationFailed */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'compensation_failed',
    error = :error,
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND status IN ('failed', 'canceled', 'compensation_failed')
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    cancel_requested_at AS "cancelRequestedAt",
    cancel_mode AS "cancelMode",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name CompleteRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'completed',
    current_step_key = NULL,
    context = :context,
    result = :result,
    error = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name AdvanceTaskStep */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    current_step_key = :nextStepKey,
    context = :context,
    result = NULL,
    error = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'completed',
    output = :output,
    error = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE id = :attemptId
    AND run_id IN (SELECT id FROM updated_run)
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name OpenWait */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'waiting',
    current_step_key = :stepKey,
    context = :context,
    result = NULL,
    error = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_wait AS (
  INSERT INTO workflow_waits (
    run_id,
    step_key,
    correlation_key,
    status,
    payload,
    expires_at
  )
  SELECT id, :stepKey, :correlationKey, 'open', :payload, :expiresAt
  FROM updated_run
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'completed',
    output = :output,
    error = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE id = :attemptId
    AND run_id IN (SELECT id FROM updated_run)
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name ScheduleRetry */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    current_step_key = :stepKey,
    error = :error,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = :availableAt,
    updated_at = now(),
    completed_at = NULL
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'failed',
    output = NULL,
    error = :error,
    completed_at = now(),
    updated_at = now()
  WHERE id = :attemptId
    AND run_id IN (SELECT id FROM updated_run)
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name FailRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'failed',
    error = :error,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'failed',
    output = NULL,
    error = :error,
    completed_at = now(),
    updated_at = now()
  WHERE id = :attemptId
    AND run_id IN (SELECT id FROM updated_run)
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name ScheduleSleep */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    current_step_key = :nextStepKey,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = :availableAt,
    updated_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name GetOpenWaitForUpdate */
SELECT
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  correlation_key AS "correlationKey",
  status,
  payload,
  resume_payload AS "resumePayload",
  resume_output AS "resumeOutput",
  expires_at AS "expiresAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  resumed_at AS "resumedAt"
FROM workflow_waits
WHERE correlation_key = :correlationKey
FOR UPDATE;

/* @name GetRunByIdForUpdate */
SELECT
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE id = :runId
FOR UPDATE;

/* @name CompleteWaitResume */
WITH updated_wait AS (
  UPDATE workflow_waits
  SET
    status = 'resumed',
    resume_payload = :resumePayload,
    resume_output = :output,
    resumed_at = now(),
    updated_at = now()
  WHERE id = :waitId
    AND status = 'open'
  RETURNING id
), updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    current_step_key = :nextStepKey,
    context = :context,
    error = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id = :runId
    AND status = 'waiting'
    AND current_step_key = :stepKey
    AND EXISTS (SELECT 1 FROM updated_wait)
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name ExtendLease */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
    updated_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
  RETURNING id
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE id = :attemptId
    AND run_id IN (SELECT id FROM updated_run)
  RETURNING id
)
SELECT CASE WHEN EXISTS (SELECT 1 FROM updated_attempt) THEN 1 ELSE 0 END::int AS ok;

/* @name CountOpenWaits */
SELECT COUNT(*)::int AS "waitCount"
FROM workflow_waits
WHERE status = 'open';

/* @name ExpireOpenWaits */
WITH expired_waits AS (
  SELECT id, run_id AS "runId", step_key AS "stepKey"
  FROM workflow_waits
  WHERE status = 'open'
    AND expires_at IS NOT NULL
    AND expires_at < now()
  ORDER BY expires_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :limit
), updated_waits AS (
  UPDATE workflow_waits
  SET
    status = 'expired',
    updated_at = now()
  WHERE id IN (SELECT id FROM expired_waits)
  RETURNING id
), updated_runs AS (
  UPDATE workflow_runs
  SET
    status = 'failed',
    error = jsonb_build_object('message', 'Wait step expired'),
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id IN (SELECT "runId" FROM expired_waits)
    AND status = 'waiting'
  RETURNING id
), inserted_events AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT "runId", "stepKey", 'wait.expired', '{}'::jsonb
  FROM expired_waits
)
SELECT COUNT(*)::int AS "expiredCount"
FROM updated_waits;

/* @name CreateSignal */
WITH target_run AS (
  SELECT id
  FROM workflow_runs
  WHERE id = :runId
), inserted_signal AS (
  INSERT INTO workflow_signals (
    run_id,
    signal_name,
    payload
  )
  SELECT id, :signalName, :payload
  FROM target_run
  RETURNING run_id AS "runId"
), updated_run AS (
  UPDATE workflow_runs
  SET
    status = CASE WHEN status = 'waiting' THEN 'queued' ELSE status END,
    available_at = CASE WHEN status = 'waiting' THEN now() ELSE available_at END,
    updated_at = now()
  WHERE id = :runId
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT :runId, NULL, 'signal.received', jsonb_build_object('signalName', :signalName)
  FROM inserted_signal
)
SELECT "runId" FROM inserted_signal;

/* @name ConsumeSignal */
WITH candidate AS (
  SELECT id
  FROM workflow_signals
  WHERE run_id = :runId
    AND signal_name = :signalName
    AND consumed_at IS NULL
  ORDER BY created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE workflow_signals
SET
  consumed_at = now(),
  updated_at = now()
WHERE id IN (SELECT id FROM candidate)
RETURNING
  id,
  run_id AS "runId",
  signal_name AS "signalName",
  payload,
  consumed_at AS "consumedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name ListRuns */
SELECT
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE (:workflowName::text IS NULL OR definition_name = :workflowName)
  AND (:status::text IS NULL OR status::text = :status)
  AND (:taskQueue::text IS NULL OR task_queue = :taskQueue)
  AND (:parentRunId::uuid IS NULL OR parent_run_id = :parentRunId)
  AND (
    :search::text IS NULL
    OR id::text ILIKE '%' || :search || '%'
    OR definition_name ILIKE '%' || :search || '%'
    OR COALESCE(current_step_key, '') ILIKE '%' || :search || '%'
  )
ORDER BY updated_at DESC, created_at DESC
LIMIT :limit;

/* @name ListRunLineage */
WITH RECURSIVE lineage AS (
  SELECT
    workflow_runs.id,
    workflow_runs.parent_run_id,
    workflow_runs.parent_step_key,
    workflow_runs.continued_from_run_id,
    workflow_runs.branched_from_run_id,
    workflow_runs.branched_from_attempt_run_id,
    workflow_runs.branched_from_attempt_id,
    workflow_runs.superseded_by_run_id,
    workflow_runs.definition_name,
    workflow_runs.definition_version,
    workflow_runs.task_queue,
    workflow_runs.priority,
    workflow_runs.status,
    workflow_runs.current_step_key,
    workflow_runs.input,
    workflow_runs.context,
    workflow_runs.result,
    workflow_runs.error,
    workflow_runs.lease_owner,
    workflow_runs.lease_expires_at,
    workflow_runs.cancel_requested_at,
    workflow_runs.cancel_mode,
    workflow_runs.available_at,
    workflow_runs.created_at,
    workflow_runs.updated_at,
    workflow_runs.completed_at
  FROM workflow_runs
  WHERE id = :runId

  UNION

  SELECT
    related.id,
    related.parent_run_id,
    related.parent_step_key,
    related.continued_from_run_id,
    related.branched_from_run_id,
    related.branched_from_attempt_run_id,
    related.branched_from_attempt_id,
    related.superseded_by_run_id,
    related.definition_name,
    related.definition_version,
    related.task_queue,
    related.priority,
    related.status,
    related.current_step_key,
    related.input,
    related.context,
    related.result,
    related.error,
    related.lease_owner,
    related.lease_expires_at,
    related.cancel_requested_at,
    related.cancel_mode,
    related.available_at,
    related.created_at,
    related.updated_at,
    related.completed_at
  FROM workflow_runs AS related
  JOIN lineage
    ON related.id = lineage.continued_from_run_id
    OR related.id = lineage.branched_from_run_id
    OR related.id = lineage.superseded_by_run_id
    OR related.continued_from_run_id = lineage.id
    OR related.branched_from_run_id = lineage.id
    OR related.superseded_by_run_id = lineage.id
)
SELECT
  id,
  parent_run_id AS "parentRunId",
  parent_step_key AS "parentStepKey",
  continued_from_run_id AS "continuedFromRunId",
  branched_from_run_id AS "branchedFromRunId",
  branched_from_attempt_run_id AS "branchedFromAttemptRunId",
  branched_from_attempt_id AS "branchedFromAttemptId",
  superseded_by_run_id AS "supersededByRunId",
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM lineage
ORDER BY created_at ASC, updated_at ASC, id ASC;

/* @name ListActiveRuns */
SELECT
  id,
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE status IN ('queued', 'running', 'waiting')
ORDER BY available_at ASC, created_at ASC
LIMIT :limit;

/* @name ListFailedRuns */
SELECT
  id,
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE status = 'failed'
   OR status = 'compensation_failed'
ORDER BY completed_at DESC NULLS LAST, updated_at DESC
LIMIT :limit;

/* @name ListStuckRuns */
SELECT
  id,
  definition_name AS "definitionName",
  definition_version AS "definitionVersion",
  task_queue AS "taskQueue",
  priority,
  status,
  current_step_key AS "currentStepKey",
  input,
  context,
  result,
  error,
  lease_owner AS "leaseOwner",
  lease_expires_at AS "leaseExpiresAt",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
FROM workflow_runs
WHERE
  (status = 'running' AND lease_expires_at < now())
  OR (
    status = 'waiting'
    AND updated_at <= now() - (:olderThanMs * interval '1 millisecond')
  )
  OR (
    status = 'queued'
    AND available_at <= now() - (:olderThanMs * interval '1 millisecond')
  )
ORDER BY updated_at ASC, available_at ASC
LIMIT :limit;

/* @name CancelRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'canceled',
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND status IN ('queued', 'running', 'waiting', 'failed')
  RETURNING
    id,
    parent_run_id AS "parentRunId",
    parent_step_key AS "parentStepKey",
    continued_from_run_id AS "continuedFromRunId",
    branched_from_run_id AS "branchedFromRunId",
    branched_from_attempt_run_id AS "branchedFromAttemptRunId",
    branched_from_attempt_id AS "branchedFromAttemptId",
    superseded_by_run_id AS "supersededByRunId",
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, "currentStepKey", :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name RetryRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    error = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = NULL
  WHERE id = :runId
    AND status = 'failed'
    AND current_step_key IS NOT NULL
  RETURNING
    id,
    definition_name AS "definitionName",
    definition_version AS "definitionVersion",
    task_queue AS "taskQueue",
    priority,
    status,
    current_step_key AS "currentStepKey",
    input,
    context,
    result,
    error,
    lease_owner AS "leaseOwner",
    lease_expires_at AS "leaseExpiresAt",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, "currentStepKey", :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name RecoverExpiredLeases */
WITH recovered AS (
  SELECT id
  FROM workflow_runs
  WHERE status = 'running'
    AND lease_expires_at < now()
  ORDER BY lease_expires_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :limit
), updated_runs AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id IN (SELECT id FROM recovered)
  RETURNING id, current_step_key AS "currentStepKey"
), inserted_events AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, "currentStepKey", 'run.recovered', '{}'::jsonb
  FROM updated_runs
)
SELECT COUNT(*)::int AS "reclaimedCount"
FROM updated_runs;

/* @name Ping */
SELECT 1::int AS ok;
