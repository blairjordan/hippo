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
  context,
  trace_context
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
  '{}'::jsonb,
  :traceContext
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
  completed_at AS "completedAt",
  trace_context AS "traceContext";

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
  completed_at AS "completedAt",
  trace_context AS "traceContext"
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
  updated_at AS "updatedAt",
  trace_context AS "traceContext",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
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
  runs.completed_at AS "completedAt",
  runs.trace_context AS "traceContext";

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
  input,
  trace_context
) VALUES (
  :runId,
  :stepKey,
  :kind,
  :stepSeq,
  :attempt,
  'started',
  :contextBefore,
  :input,
  :traceContext
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
  updated_at AS "updatedAt",
  trace_context AS "traceContext",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind";

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
  updated_at AS "updatedAt",
  trace_context AS "traceContext",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
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
  context,
  trace_context
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
  :context,
  :traceContext
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
  completed_at AS "completedAt",
  trace_context AS "traceContext";

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
    expires_at,
    external_session_id,
    external_session_kind
  )
  SELECT
    id,
    :stepKey,
    :correlationKey,
    'open',
    :payload,
    :expiresAt,
    :externalSessionId,
    :externalSessionKind
  FROM updated_run
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'completed',
    output = :output,
    error = NULL,
    external_session_id = :externalSessionId,
    external_session_kind = :externalSessionKind,
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

/* @name OpenFanOutWaits */
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
), inserted_waits AS (
  INSERT INTO workflow_waits (
    run_id,
    step_key,
    correlation_key,
    status,
    payload,
    expires_at
  )
  SELECT
    updated_run.id,
    :stepKey,
    wait_entry.correlation_key,
    'open',
    wait_entry.payload,
    wait_entry.expires_at
  FROM updated_run
  CROSS JOIN LATERAL jsonb_to_recordset(:waits::jsonb) AS wait_entry(
    correlation_key text,
    payload jsonb,
    expires_at timestamptz
  )
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
  resumed_at AS "resumedAt",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
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
  completed_at AS "completedAt",
  trace_context AS "traceContext"
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
    lease_owner = NULL,
    lease_expires_at = NULL,
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

/* @name CompleteExpiredWaitTransition */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    current_step_key = :nextStepKey,
    context = :context,
    result = :output,
    error = NULL,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id = :runId
    AND status = 'waiting'
    AND current_step_key = :stepKey
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
), updated_wait AS (
  UPDATE workflow_waits
  SET
    resume_output = :output,
    updated_at = now()
  WHERE id = :waitId
    AND status = 'expired'
    AND EXISTS (SELECT 1 FROM updated_run)
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, :eventType, :eventPayload
  FROM updated_run
  WHERE EXISTS (SELECT 1 FROM updated_wait)
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

/* @name RecordExternalHeartbeat */
WITH locked_wait AS (
  SELECT
    id,
    run_id,
    step_key
  FROM workflow_waits
  WHERE external_session_id = :externalSessionId
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE
), updated_run AS (
  UPDATE workflow_runs
  SET
    lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
    updated_at = now()
  WHERE id IN (SELECT run_id FROM locked_wait)
    AND status = 'waiting'
    AND current_step_key IN (SELECT step_key FROM locked_wait)
  RETURNING id
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    last_heartbeat_at = now(),
    updated_at = now()
  WHERE run_id IN (SELECT id FROM updated_run)
    AND step_key IN (SELECT step_key FROM locked_wait)
    AND external_session_id = :externalSessionId
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, (SELECT step_key FROM locked_wait), 'step.external_heartbeat', :payload
  FROM updated_run
  WHERE EXISTS (SELECT 1 FROM updated_attempt)
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'
    WHEN NOT EXISTS (SELECT 1 FROM updated_attempt) THEN 'stale'
    ELSE 'recorded'
  END AS status,
  (SELECT id FROM updated_run) AS "runId",
  (SELECT step_key FROM locked_wait) AS "stepKey",
  (SELECT id FROM updated_attempt) AS "attemptId";

/* @name ListOpenExternalSessions */
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
  resumed_at AS "resumedAt",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
FROM workflow_waits
WHERE run_id = :runId
  AND status = 'open'
  AND external_session_id IS NOT NULL
ORDER BY created_at ASC;

/* @name ListStepWaits */
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
  resumed_at AS "resumedAt",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
FROM workflow_waits
WHERE run_id = :runId
  AND step_key = :stepKey
ORDER BY created_at ASC;

/* @name RecordExternalSessionEvent */
WITH locked_wait AS (
  SELECT
    id,
    run_id,
    step_key
  FROM workflow_waits
  WHERE external_session_id = :externalSessionId
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE
), active_run AS (
  SELECT id
  FROM workflow_runs
  WHERE id IN (SELECT run_id FROM locked_wait)
    AND status = 'waiting'
    AND current_step_key IN (SELECT step_key FROM locked_wait)
), active_attempt AS (
  SELECT id
  FROM workflow_step_attempts
  WHERE run_id IN (SELECT id FROM active_run)
    AND step_key IN (SELECT step_key FROM locked_wait)
    AND external_session_id = :externalSessionId
  ORDER BY created_at DESC
  LIMIT 1
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT
    id,
    (SELECT step_key FROM locked_wait),
    :eventType,
    jsonb_build_object(
      'type',
      :type::text,
      'data',
      :data::jsonb,
      'stepKey',
      (SELECT step_key FROM locked_wait),
      'stepAttemptId',
      (SELECT id FROM active_attempt)
    )
  FROM active_run
  WHERE EXISTS (SELECT 1 FROM active_attempt)
  RETURNING id
)
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'
    WHEN NOT EXISTS (SELECT 1 FROM active_attempt) THEN 'stale'
    ELSE 'recorded'
  END AS status,
  (SELECT id FROM active_run) AS "runId",
  (SELECT step_key FROM locked_wait) AS "stepKey",
  (SELECT id FROM active_attempt) AS "attemptId",
  (SELECT id FROM inserted_event) AS "eventId";

/* @name InsertUsage */
INSERT INTO workflow_run_usage (
  run_id,
  step_attempt_id,
  resource,
  amount,
  cost_usd,
  dimension
) VALUES (
  :runId,
  :stepAttemptId,
  :resource,
  :amount,
  :costUsd,
  :dimension
)
RETURNING
  id,
  run_id AS "runId",
  step_attempt_id AS "stepAttemptId",
  resource,
  amount,
  cost_usd AS "costUsd",
  dimension,
  recorded_at AS "recordedAt";

/* @name GetUsageTotals */
SELECT
  COALESCE(SUM(amount) FILTER (WHERE resource = :resource), 0)::text AS "resourceAmount",
  COALESCE(SUM(cost_usd), 0)::text AS "costUsd"
FROM workflow_run_usage
WHERE run_id = :runId;

/* @name GetRunUsage */
SELECT
  id,
  run_id AS "runId",
  step_attempt_id AS "stepAttemptId",
  resource,
  amount,
  cost_usd AS "costUsd",
  dimension,
  recorded_at AS "recordedAt"
FROM workflow_run_usage
WHERE run_id = :runId
ORDER BY recorded_at ASC, id ASC;

/* @name ExhaustRunBudget */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'exhausted_budget',
    current_step_key = NULL,
    error = :error,
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND status NOT IN ('completed', 'failed', 'compensation_failed', 'canceled', 'exhausted_budget')
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
    completed_at AS "completedAt",
    trace_context AS "traceContext"
), updated_attempt AS (
  UPDATE workflow_step_attempts
  SET
    status = 'failed',
    error = :error,
    completed_at = now(),
    updated_at = now()
  WHERE id = :stepAttemptId
    AND run_id IN (SELECT id FROM updated_run)
    AND status = 'started'
), canceled_waits AS (
  UPDATE workflow_waits
  SET
    status = 'canceled',
    updated_at = now()
  WHERE run_id IN (SELECT id FROM updated_run)
    AND status = 'open'
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'run.exhausted_budget', :error
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name CountOpenWaits */
SELECT COUNT(*)::int AS "waitCount"
FROM workflow_waits
WHERE status = 'open';

/* @name ExpireOpenWaits */
SELECT
  id,
  run_id AS "runId",
  step_key AS "stepKey",
  correlation_key AS "correlationKey",
  payload,
  expires_at AS "expiresAt"
FROM workflow_waits
WHERE status = 'open'
  AND expires_at IS NOT NULL
  AND expires_at < now()
ORDER BY expires_at ASC
FOR UPDATE SKIP LOCKED
LIMIT :limit;

/* @name FailExpiredWaitRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'failed',
    error = jsonb_build_object('message', 'Wait step expired'),
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now(),
    completed_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND status = 'waiting'
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'wait.expired', '{}'::jsonb
  FROM updated_run
)
SELECT
  id AS "runId"
FROM updated_run;

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

/* @name StartRunIdempotent */
WITH existing_run AS (
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
    completed_at AS "completedAt",
    trace_context AS "traceContext",
    FALSE AS inserted
  FROM workflow_runs
  WHERE definition_name = :definitionName
    AND idempotency_key = :idempotencyKey
), inserted_run AS (
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
    context,
    trace_context
  )
  SELECT
    :parentRunId,
    :parentStepKey,
    :definitionName,
    :definitionVersion,
    :taskQueue,
    :priority,
    'queued'::workflow_run_status,
    :currentStepKey,
    :idempotencyKey,
    :input,
    '{}'::jsonb,
    :traceContext
  WHERE NOT EXISTS (SELECT 1 FROM existing_run)
  ON CONFLICT (definition_name, idempotency_key) DO NOTHING
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
    completed_at AS "completedAt",
    trace_context AS "traceContext",
    TRUE AS inserted
)
SELECT * FROM inserted_run
UNION ALL
SELECT * FROM existing_run
LIMIT 1;

/* @name GetRunByDefinitionAndIdempotencyKey */
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
WHERE definition_name = :definitionName
  AND idempotency_key = :idempotencyKey
LIMIT 1;

/* @name ContinueAsNewCompleteSource */
UPDATE workflow_runs
SET
  status = 'completed',
  current_step_key = NULL,
  context = :context,
  result = NULL,
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
  cancel_requested_at AS "cancelRequestedAt",
  cancel_mode AS "cancelMode",
  available_at AS "availableAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt";

/* @name ContinueAsNewInsertRun */
INSERT INTO workflow_runs (
  continued_from_run_id,
  definition_name,
  definition_version,
  task_queue,
  priority,
  status,
  current_step_key,
  input,
  context,
  trace_context
) VALUES (
  :continuedFromRunId,
  :definitionName,
  :definitionVersion,
  :taskQueue,
  :priority,
  'queued',
  :currentStepKey,
  :input,
  '{}'::jsonb,
  :traceContext
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
  completed_at AS "completedAt",
  trace_context AS "traceContext";

/* @name ContinueAsNewSetResult */
UPDATE workflow_runs
SET
  result = jsonb_build_object('continuedRunId', :continuedRunId::text),
  updated_at = now()
WHERE id = :runId;

/* @name ContinueAsNewCompleteAttempt */
UPDATE workflow_step_attempts
SET
  status = 'completed',
  output = jsonb_build_object('continuedRunId', :continuedRunId::text),
  error = NULL,
  completed_at = now(),
  updated_at = now()
WHERE id = :attemptId
  AND run_id = :runId;

/* @name GetChildRun */
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
WHERE parent_run_id = :parentRunId
  AND parent_step_key = :parentStepKey
ORDER BY created_at ASC
LIMIT 1;

/* @name ListChildRuns */
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
WHERE parent_run_id = :parentRunId
ORDER BY created_at ASC;

/* @name WakeParentForChild */
WITH updated_wait AS (
  UPDATE workflow_waits
  SET
    status = 'resumed',
    resume_payload = :payload,
    resumed_at = now(),
    updated_at = now()
  WHERE correlation_key = :correlationKey
    AND status = 'open'
  RETURNING run_id AS "runId", step_key AS "stepKey"
), updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id IN (SELECT "runId" FROM updated_wait)
    AND status = 'waiting'
  RETURNING id
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT "runId", "stepKey", 'child.completed', :payload
  FROM updated_wait
  WHERE EXISTS (SELECT 1 FROM updated_run)
)
SELECT id AS "runId"
FROM updated_run;

/* @name GetFanOutWaitByChildRunId */
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
  resumed_at AS "resumedAt",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind"
FROM workflow_waits
WHERE status = 'open'
  AND payload->>'kind' = 'fanOutChild'
  AND payload->>'childRunId' = :childRunId
LIMIT 1;

/* @name UpdateWaitStatus */
UPDATE workflow_waits
SET
  status = :status::workflow_wait_status,
  resume_payload = :resumePayload,
  updated_at = now(),
  resumed_at = CASE
    WHEN :status::workflow_wait_status = 'resumed'::workflow_wait_status THEN now()
    ELSE resumed_at
  END
WHERE id = :waitId
RETURNING
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
  resumed_at AS "resumedAt",
  external_session_id AS "externalSessionId",
  external_session_kind AS "externalSessionKind";

/* @name QueueWaitingRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    status = 'queued',
    lease_owner = NULL,
    lease_expires_at = NULL,
    available_at = now(),
    updated_at = now()
  WHERE id = :runId
    AND current_step_key = :stepKey
    AND status = 'waiting'
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

/* @name RequestCancelRun */
WITH updated_run AS (
  UPDATE workflow_runs
  SET
    cancel_requested_at = now(),
    cancel_mode = :mode,
    status = CASE
      WHEN :mode = 'hard' THEN 'canceled'::workflow_run_status
      WHEN status = 'waiting' THEN 'queued'::workflow_run_status
      WHEN status = 'failed' THEN 'canceled'::workflow_run_status
      ELSE status
    END,
    lease_owner = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_owner END,
    lease_expires_at = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_expires_at END,
    available_at = now(),
    updated_at = now(),
    completed_at = CASE
      WHEN :mode = 'hard' OR status = 'failed' THEN now()
      ELSE completed_at
    END
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
    cancel_requested_at AS "cancelRequestedAt",
    cancel_mode AS "cancelMode",
    available_at AS "availableAt",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    completed_at AS "completedAt"
), canceled_waits AS (
  UPDATE workflow_waits
  SET
    status = CASE WHEN :mode = 'hard' THEN 'canceled'::workflow_wait_status ELSE status END,
    updated_at = now()
  WHERE run_id IN (SELECT id FROM updated_run)
    AND status = 'open'
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, "currentStepKey", :eventType, :eventPayload
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name CancelRunAtBoundary */
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
    AND current_step_key = :stepKey
    AND lease_owner = :workerId
    AND lease_expires_at >= now()
    AND cancel_requested_at IS NOT NULL
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
), canceled_waits AS (
  UPDATE workflow_waits
  SET
    status = 'canceled',
    updated_at = now()
  WHERE run_id IN (SELECT id FROM updated_run)
    AND status = 'open'
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'run.canceled', jsonb_build_object('mode', :mode::text)
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name InsertOutbox */
INSERT INTO workflow_outbox (
  run_id,
  topic,
  payload,
  available_at
) VALUES (
  :runId,
  :topic,
  :payload,
  COALESCE(:availableAt, now())
)
RETURNING
  id,
  run_id AS "runId",
  topic,
  payload,
  available_at AS "availableAt",
  delivered_at AS "deliveredAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name ClaimOutboxMessages */
WITH candidate AS (
  SELECT id
  FROM workflow_outbox
  WHERE delivered_at IS NULL
    AND available_at <= now()
  ORDER BY available_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT :limit
)
UPDATE workflow_outbox
SET
  available_at = now() + interval '30 seconds',
  updated_at = now()
WHERE id IN (SELECT id FROM candidate)
RETURNING
  id,
  run_id AS "runId",
  topic,
  payload,
  available_at AS "availableAt",
  delivered_at AS "deliveredAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name MarkOutboxDelivered */
UPDATE workflow_outbox
SET
  delivered_at = now(),
  updated_at = now()
WHERE id = :outboxId
  AND delivered_at IS NULL
RETURNING 1::int AS delivered;

/* @name CreateSchedule */
INSERT INTO workflow_schedules (
  workflow_name,
  cron_expression,
  payload,
  task_queue,
  priority,
  next_fire_at
) VALUES (
  :workflowName,
  :cronExpression,
  :payload,
  :taskQueue,
  :priority,
  :nextFireAt
)
RETURNING
  id,
  workflow_name AS "workflowName",
  cron_expression AS "cronExpression",
  payload,
  task_queue AS "taskQueue",
  priority,
  active,
  next_fire_at AS "nextFireAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt";

/* @name ListSchedules */
SELECT
  id,
  workflow_name AS "workflowName",
  cron_expression AS "cronExpression",
  payload,
  task_queue AS "taskQueue",
  priority,
  active,
  next_fire_at AS "nextFireAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM workflow_schedules
ORDER BY next_fire_at ASC, created_at ASC;

/* @name ClaimDueSchedules */
SELECT
  id,
  workflow_name AS "workflowName",
  cron_expression AS "cronExpression",
  payload,
  task_queue AS "taskQueue",
  priority,
  active,
  next_fire_at AS "nextFireAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
FROM workflow_schedules
WHERE active = TRUE
  AND next_fire_at <= now()
ORDER BY next_fire_at ASC, created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT :limit;

/* @name RescheduleAfterFire */
UPDATE workflow_schedules
SET
  next_fire_at = :nextFireAt,
  updated_at = now()
WHERE id = :id;

/* @name CompleteTransactionalTask */
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
    cancel_requested_at AS "cancelRequestedAt",
    cancel_mode AS "cancelMode",
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
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'step.completed', jsonb_build_object('nextStepKey', :nextStepKey)
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name RetryTransactionalTask */
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
    cancel_requested_at AS "cancelRequestedAt",
    cancel_mode AS "cancelMode",
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
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'step.retry_scheduled',
    jsonb_build_object('availableAt', to_jsonb(:availableAt))
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name FailTransactionalTask */
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
    cancel_requested_at AS "cancelRequestedAt",
    cancel_mode AS "cancelMode",
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
), inserted_event AS (
  INSERT INTO workflow_events (run_id, step_key, event_type, payload)
  SELECT id, :stepKey, 'step.failed', :error
  FROM updated_run
)
SELECT * FROM updated_run;

/* @name GetKV */
SELECT value FROM workflow_run_kv
WHERE run_id = :runId AND key = :key;

/* @name SetKV */
INSERT INTO workflow_run_kv (run_id, key, value, updated_at)
VALUES (:runId, :key, :value, now())
ON CONFLICT (run_id, key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

/* @name DeleteKV */
DELETE FROM workflow_run_kv
WHERE run_id = :runId AND key = :key;
