/** Types generated for queries found in "src/sql/workflow-store.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type step_attempt_kind = 'compensate' | 'forward';

export type step_attempt_status = 'completed' | 'failed' | 'started';

export type workflow_run_status = 'canceled' | 'compensation_failed' | 'completed' | 'exhausted_budget' | 'failed' | 'queued' | 'running' | 'waiting';

export type workflow_wait_status = 'canceled' | 'expired' | 'open' | 'resumed';

export type DateOrString = Date | string;

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type NumberOrString = number | string;

export type stringArray = (string)[];

/** 'InsertRun' parameters type */
export interface IInsertRunParams {
  currentStepKey?: string | null | void;
  definitionName?: string | null | void;
  definitionVersion?: number | null | void;
  idempotencyKey?: string | null | void;
  input?: Json | null | void;
  parentRunId?: string | null | void;
  parentStepKey?: string | null | void;
  priority?: number | null | void;
  taskQueue?: string | null | void;
  traceContext?: string | null | void;
}

/** 'InsertRun' return type */
export interface IInsertRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'InsertRun' query type */
export interface IInsertRunQuery {
  params: IInsertRunParams;
  result: IInsertRunResult;
}

const insertRunIR: any = {"usedParamSet":{"parentRunId":true,"parentStepKey":true,"definitionName":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"idempotencyKey":true,"input":true,"traceContext":true},"params":[{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":229,"b":240}]},{"name":"parentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":245,"b":258}]},{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":263,"b":277}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":282,"b":299}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":304,"b":313}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":318,"b":326}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":343,"b":357}]},{"name":"idempotencyKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":362,"b":376}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":381,"b":386}]},{"name":"traceContext","required":false,"transform":{"type":"scalar"},"locs":[{"a":406,"b":418}]}],"statement":"INSERT INTO workflow_runs (\n  parent_run_id,\n  parent_step_key,\n  definition_name,\n  definition_version,\n  task_queue,\n  priority,\n  status,\n  current_step_key,\n  idempotency_key,\n  input,\n  context,\n  trace_context\n) VALUES (\n  :parentRunId,\n  :parentStepKey,\n  :definitionName,\n  :definitionVersion,\n  :taskQueue,\n  :priority,\n  'queued',\n  :currentStepKey,\n  :idempotencyKey,\n  :input,\n  '{}'::jsonb,\n  :traceContext\n)\nON CONFLICT (definition_name, idempotency_key)\nDO UPDATE SET\n  idempotency_key = workflow_runs.idempotency_key\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\",\n  trace_context AS \"traceContext\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_runs (
 *   parent_run_id,
 *   parent_step_key,
 *   definition_name,
 *   definition_version,
 *   task_queue,
 *   priority,
 *   status,
 *   current_step_key,
 *   idempotency_key,
 *   input,
 *   context,
 *   trace_context
 * ) VALUES (
 *   :parentRunId,
 *   :parentStepKey,
 *   :definitionName,
 *   :definitionVersion,
 *   :taskQueue,
 *   :priority,
 *   'queued',
 *   :currentStepKey,
 *   :idempotencyKey,
 *   :input,
 *   '{}'::jsonb,
 *   :traceContext
 * )
 * ON CONFLICT (definition_name, idempotency_key)
 * DO UPDATE SET
 *   idempotency_key = workflow_runs.idempotency_key
 * RETURNING
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt",
 *   trace_context AS "traceContext"
 * ```
 */
export const insertRun = new PreparedQuery<IInsertRunParams,IInsertRunResult>(insertRunIR);


/** 'GetRunById' parameters type */
export interface IGetRunByIdParams {
  runId?: string | null | void;
}

/** 'GetRunById' return type */
export interface IGetRunByIdResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'GetRunById' query type */
export interface IGetRunByIdQuery {
  params: IGetRunByIdParams;
  result: IGetRunByIdResult;
}

const getRunByIdIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":895,"b":900}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\",\n  trace_context AS \"traceContext\"\nFROM workflow_runs\nWHERE id = :runId"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt",
 *   trace_context AS "traceContext"
 * FROM workflow_runs
 * WHERE id = :runId
 * ```
 */
export const getRunById = new PreparedQuery<IGetRunByIdParams,IGetRunByIdResult>(getRunByIdIR);


/** 'GetRunEvents' parameters type */
export interface IGetRunEventsParams {
  runId?: string | null | void;
}

/** 'GetRunEvents' return type */
export interface IGetRunEventsResult {
  createdAt: Date;
  eventType: string;
  id: string;
  payload: Json;
  runId: string;
  stepKey: string | null;
}

/** 'GetRunEvents' query type */
export interface IGetRunEventsQuery {
  params: IGetRunEventsParams;
  result: IGetRunEventsResult;
}

const getRunEventsIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":163,"b":168}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  event_type AS \"eventType\",\n  payload,\n  created_at AS \"createdAt\"\nFROM workflow_events\nWHERE run_id = :runId\nORDER BY created_at ASC, id ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   event_type AS "eventType",
 *   payload,
 *   created_at AS "createdAt"
 * FROM workflow_events
 * WHERE run_id = :runId
 * ORDER BY created_at ASC, id ASC
 * ```
 */
export const getRunEvents = new PreparedQuery<IGetRunEventsParams,IGetRunEventsResult>(getRunEventsIR);


/** 'GetRunAttempts' parameters type */
export interface IGetRunAttemptsParams {
  runId?: string | null | void;
}

/** 'GetRunAttempts' return type */
export interface IGetRunAttemptsResult {
  attempt: number;
  completedAt: Date | null;
  contextBefore: Json;
  createdAt: Date;
  error: Json | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  input: Json;
  kind: step_attempt_kind;
  lastHeartbeatAt: Date | null;
  output: Json | null;
  runId: string;
  startedAt: Date;
  status: step_attempt_status;
  stepKey: string;
  stepSeq: number;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'GetRunAttempts' query type */
export interface IGetRunAttemptsQuery {
  params: IGetRunAttemptsParams;
  result: IGetRunAttemptsResult;
}

const getRunAttemptsIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":513,"b":518}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  trace_context AS \"traceContext\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_step_attempts\nWHERE run_id = :runId\nORDER BY step_seq ASC, attempt ASC, created_at ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   kind,
 *   step_seq AS "stepSeq",
 *   attempt,
 *   status,
 *   context_before AS "contextBefore",
 *   input,
 *   output,
 *   error,
 *   started_at AS "startedAt",
 *   last_heartbeat_at AS "lastHeartbeatAt",
 *   completed_at AS "completedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   trace_context AS "traceContext",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_step_attempts
 * WHERE run_id = :runId
 * ORDER BY step_seq ASC, attempt ASC, created_at ASC
 * ```
 */
export const getRunAttempts = new PreparedQuery<IGetRunAttemptsParams,IGetRunAttemptsResult>(getRunAttemptsIR);


/** 'InsertEvent' parameters type */
export interface IInsertEventParams {
  eventType?: string | null | void;
  payload?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'InsertEvent' return type */
export interface IInsertEventResult {
  createdAt: Date;
  eventType: string;
  id: string;
  payload: Json;
  runId: string;
  stepKey: string | null;
}

/** 'InsertEvent' query type */
export interface IInsertEventQuery {
  params: IInsertEventParams;
  result: IInsertEventResult;
}

const insertEventIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"eventType":true,"payload":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":89,"b":94}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":99,"b":106}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":111,"b":120}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":125,"b":132}]}],"statement":"INSERT INTO workflow_events (\n  run_id,\n  step_key,\n  event_type,\n  payload\n) VALUES (\n  :runId,\n  :stepKey,\n  :eventType,\n  :payload\n)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  event_type AS \"eventType\",\n  payload,\n  created_at AS \"createdAt\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_events (
 *   run_id,
 *   step_key,
 *   event_type,
 *   payload
 * ) VALUES (
 *   :runId,
 *   :stepKey,
 *   :eventType,
 *   :payload
 * )
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   event_type AS "eventType",
 *   payload,
 *   created_at AS "createdAt"
 * ```
 */
export const insertEvent = new PreparedQuery<IInsertEventParams,IInsertEventResult>(insertEventIR);


/** 'ClaimNextRunnableRun' parameters type */
export interface IClaimNextRunnableRunParams {
  leaseMs?: number | null | void;
  taskQueues?: stringArray | null | void;
  workerId?: string | null | void;
}

/** 'ClaimNextRunnableRun' return type */
export interface IClaimNextRunnableRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'ClaimNextRunnableRun' query type */
export interface IClaimNextRunnableRunQuery {
  params: IClaimNextRunnableRunParams;
  result: IClaimNextRunnableRunResult;
}

const claimNextRunnableRunIR: any = {"usedParamSet":{"taskQueues":true,"workerId":true,"leaseMs":true},"params":[{"name":"taskQueues","required":false,"transform":{"type":"scalar"},"locs":[{"a":118,"b":128}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":428,"b":436}]},{"name":"leaseMs","required":false,"transform":{"type":"scalar"},"locs":[{"a":469,"b":476}]}],"statement":"WITH candidate AS (\n  SELECT id\n  FROM workflow_runs\n  WHERE status IN ('queued', 'running')\n    AND task_queue = ANY(:taskQueues)\n    AND current_step_key IS NOT NULL\n    AND available_at <= now()\n    AND (lease_expires_at IS NULL OR lease_expires_at < now())\n  ORDER BY priority DESC, available_at ASC, created_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT 1\n)\nUPDATE workflow_runs AS runs\nSET\n  status = 'running',\n  lease_owner = :workerId,\n  lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),\n  updated_at = now()\nFROM candidate\nWHERE runs.id = candidate.id\nRETURNING\n  runs.id,\n  runs.parent_run_id AS \"parentRunId\",\n  runs.parent_step_key AS \"parentStepKey\",\n  runs.continued_from_run_id AS \"continuedFromRunId\",\n  runs.branched_from_run_id AS \"branchedFromRunId\",\n  runs.branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  runs.branched_from_attempt_id AS \"branchedFromAttemptId\",\n  runs.superseded_by_run_id AS \"supersededByRunId\",\n  runs.definition_name AS \"definitionName\",\n  runs.definition_version AS \"definitionVersion\",\n  runs.task_queue AS \"taskQueue\",\n  runs.priority,\n  runs.status,\n  runs.current_step_key AS \"currentStepKey\",\n  runs.input,\n  runs.context,\n  runs.result,\n  runs.error,\n  runs.lease_owner AS \"leaseOwner\",\n  runs.lease_expires_at AS \"leaseExpiresAt\",\n  runs.available_at AS \"availableAt\",\n  runs.created_at AS \"createdAt\",\n  runs.updated_at AS \"updatedAt\",\n  runs.completed_at AS \"completedAt\",\n  runs.trace_context AS \"traceContext\""};

/**
 * Query generated from SQL:
 * ```
 * WITH candidate AS (
 *   SELECT id
 *   FROM workflow_runs
 *   WHERE status IN ('queued', 'running')
 *     AND task_queue = ANY(:taskQueues)
 *     AND current_step_key IS NOT NULL
 *     AND available_at <= now()
 *     AND (lease_expires_at IS NULL OR lease_expires_at < now())
 *   ORDER BY priority DESC, available_at ASC, created_at ASC
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT 1
 * )
 * UPDATE workflow_runs AS runs
 * SET
 *   status = 'running',
 *   lease_owner = :workerId,
 *   lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
 *   updated_at = now()
 * FROM candidate
 * WHERE runs.id = candidate.id
 * RETURNING
 *   runs.id,
 *   runs.parent_run_id AS "parentRunId",
 *   runs.parent_step_key AS "parentStepKey",
 *   runs.continued_from_run_id AS "continuedFromRunId",
 *   runs.branched_from_run_id AS "branchedFromRunId",
 *   runs.branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   runs.branched_from_attempt_id AS "branchedFromAttemptId",
 *   runs.superseded_by_run_id AS "supersededByRunId",
 *   runs.definition_name AS "definitionName",
 *   runs.definition_version AS "definitionVersion",
 *   runs.task_queue AS "taskQueue",
 *   runs.priority,
 *   runs.status,
 *   runs.current_step_key AS "currentStepKey",
 *   runs.input,
 *   runs.context,
 *   runs.result,
 *   runs.error,
 *   runs.lease_owner AS "leaseOwner",
 *   runs.lease_expires_at AS "leaseExpiresAt",
 *   runs.available_at AS "availableAt",
 *   runs.created_at AS "createdAt",
 *   runs.updated_at AS "updatedAt",
 *   runs.completed_at AS "completedAt",
 *   runs.trace_context AS "traceContext"
 * ```
 */
export const claimNextRunnableRun = new PreparedQuery<IClaimNextRunnableRunParams,IClaimNextRunnableRunResult>(claimNextRunnableRunIR);


/** 'GetLastStepAttempt' parameters type */
export interface IGetLastStepAttemptParams {
  kind?: step_attempt_kind | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'GetLastStepAttempt' return type */
export interface IGetLastStepAttemptResult {
  lastAttempt: number | null;
}

/** 'GetLastStepAttempt' query type */
export interface IGetLastStepAttemptQuery {
  params: IGetLastStepAttemptParams;
  result: IGetLastStepAttemptResult;
}

const getLastStepAttemptIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"kind":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":103}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":122,"b":129}]},{"name":"kind","required":false,"transform":{"type":"scalar"},"locs":[{"a":144,"b":148}]}],"statement":"SELECT COALESCE(MAX(attempt), 0)::int AS \"lastAttempt\"\nFROM workflow_step_attempts\nWHERE run_id = :runId\n  AND step_key = :stepKey\n  AND kind = :kind"};

/**
 * Query generated from SQL:
 * ```
 * SELECT COALESCE(MAX(attempt), 0)::int AS "lastAttempt"
 * FROM workflow_step_attempts
 * WHERE run_id = :runId
 *   AND step_key = :stepKey
 *   AND kind = :kind
 * ```
 */
export const getLastStepAttempt = new PreparedQuery<IGetLastStepAttemptParams,IGetLastStepAttemptResult>(getLastStepAttemptIR);


/** 'GetLastStepSequence' parameters type */
export interface IGetLastStepSequenceParams {
  runId?: string | null | void;
}

/** 'GetLastStepSequence' return type */
export interface IGetLastStepSequenceResult {
  lastStepSeq: number | null;
}

/** 'GetLastStepSequence' query type */
export interface IGetLastStepSequenceQuery {
  params: IGetLastStepSequenceParams;
  result: IGetLastStepSequenceResult;
}

const getLastStepSequenceIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":99,"b":104}]}],"statement":"SELECT COALESCE(MAX(step_seq), 0)::int AS \"lastStepSeq\"\nFROM workflow_step_attempts\nWHERE run_id = :runId"};

/**
 * Query generated from SQL:
 * ```
 * SELECT COALESCE(MAX(step_seq), 0)::int AS "lastStepSeq"
 * FROM workflow_step_attempts
 * WHERE run_id = :runId
 * ```
 */
export const getLastStepSequence = new PreparedQuery<IGetLastStepSequenceParams,IGetLastStepSequenceResult>(getLastStepSequenceIR);


/** 'InsertStepAttempt' parameters type */
export interface IInsertStepAttemptParams {
  attempt?: number | null | void;
  contextBefore?: Json | null | void;
  input?: Json | null | void;
  kind?: step_attempt_kind | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  stepSeq?: number | null | void;
  traceContext?: string | null | void;
}

/** 'InsertStepAttempt' return type */
export interface IInsertStepAttemptResult {
  attempt: number;
  completedAt: Date | null;
  contextBefore: Json;
  createdAt: Date;
  error: Json | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  input: Json;
  kind: step_attempt_kind;
  lastHeartbeatAt: Date | null;
  output: Json | null;
  runId: string;
  startedAt: Date;
  status: step_attempt_status;
  stepKey: string;
  stepSeq: number;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'InsertStepAttempt' query type */
export interface IInsertStepAttemptQuery {
  params: IInsertStepAttemptParams;
  result: IInsertStepAttemptResult;
}

const insertStepAttemptIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"kind":true,"stepSeq":true,"attempt":true,"contextBefore":true,"input":true,"traceContext":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":156,"b":161}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":166,"b":173}]},{"name":"kind","required":false,"transform":{"type":"scalar"},"locs":[{"a":178,"b":182}]},{"name":"stepSeq","required":false,"transform":{"type":"scalar"},"locs":[{"a":187,"b":194}]},{"name":"attempt","required":false,"transform":{"type":"scalar"},"locs":[{"a":199,"b":206}]},{"name":"contextBefore","required":false,"transform":{"type":"scalar"},"locs":[{"a":224,"b":237}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":242,"b":247}]},{"name":"traceContext","required":false,"transform":{"type":"scalar"},"locs":[{"a":252,"b":264}]}],"statement":"INSERT INTO workflow_step_attempts (\n  run_id,\n  step_key,\n  kind,\n  step_seq,\n  attempt,\n  status,\n  context_before,\n  input,\n  trace_context\n) VALUES (\n  :runId,\n  :stepKey,\n  :kind,\n  :stepSeq,\n  :attempt,\n  'started',\n  :contextBefore,\n  :input,\n  :traceContext\n)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  trace_context AS \"traceContext\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_step_attempts (
 *   run_id,
 *   step_key,
 *   kind,
 *   step_seq,
 *   attempt,
 *   status,
 *   context_before,
 *   input,
 *   trace_context
 * ) VALUES (
 *   :runId,
 *   :stepKey,
 *   :kind,
 *   :stepSeq,
 *   :attempt,
 *   'started',
 *   :contextBefore,
 *   :input,
 *   :traceContext
 * )
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   kind,
 *   step_seq AS "stepSeq",
 *   attempt,
 *   status,
 *   context_before AS "contextBefore",
 *   input,
 *   output,
 *   error,
 *   started_at AS "startedAt",
 *   last_heartbeat_at AS "lastHeartbeatAt",
 *   completed_at AS "completedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   trace_context AS "traceContext",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * ```
 */
export const insertStepAttempt = new PreparedQuery<IInsertStepAttemptParams,IInsertStepAttemptResult>(insertStepAttemptIR);


/** 'GetStepAttemptByIdForRun' parameters type */
export interface IGetStepAttemptByIdForRunParams {
  attemptId?: string | null | void;
  runId?: string | null | void;
}

/** 'GetStepAttemptByIdForRun' return type */
export interface IGetStepAttemptByIdForRunResult {
  attempt: number;
  completedAt: Date | null;
  contextBefore: Json;
  createdAt: Date;
  error: Json | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  input: Json;
  kind: step_attempt_kind;
  lastHeartbeatAt: Date | null;
  output: Json | null;
  runId: string;
  startedAt: Date;
  status: step_attempt_status;
  stepKey: string;
  stepSeq: number;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'GetStepAttemptByIdForRun' query type */
export interface IGetStepAttemptByIdForRunQuery {
  params: IGetStepAttemptByIdForRunParams;
  result: IGetStepAttemptByIdForRunResult;
}

const getStepAttemptByIdForRunIR: any = {"usedParamSet":{"runId":true,"attemptId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":513,"b":518}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":531,"b":540}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  trace_context AS \"traceContext\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_step_attempts\nWHERE run_id = :runId\n  AND id = :attemptId"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   kind,
 *   step_seq AS "stepSeq",
 *   attempt,
 *   status,
 *   context_before AS "contextBefore",
 *   input,
 *   output,
 *   error,
 *   started_at AS "startedAt",
 *   last_heartbeat_at AS "lastHeartbeatAt",
 *   completed_at AS "completedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   trace_context AS "traceContext",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_step_attempts
 * WHERE run_id = :runId
 *   AND id = :attemptId
 * ```
 */
export const getStepAttemptByIdForRun = new PreparedQuery<IGetStepAttemptByIdForRunParams,IGetStepAttemptByIdForRunResult>(getStepAttemptByIdForRunIR);


/** 'InsertBranchedRun' parameters type */
export interface IInsertBranchedRunParams {
  branchedFromAttemptId?: string | null | void;
  branchedFromAttemptRunId?: string | null | void;
  branchedFromRunId?: string | null | void;
  context?: Json | null | void;
  currentStepKey?: string | null | void;
  definitionName?: string | null | void;
  definitionVersion?: number | null | void;
  input?: Json | null | void;
  priority?: number | null | void;
  taskQueue?: string | null | void;
  traceContext?: string | null | void;
}

/** 'InsertBranchedRun' return type */
export interface IInsertBranchedRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'InsertBranchedRun' query type */
export interface IInsertBranchedRunQuery {
  params: IInsertBranchedRunParams;
  result: IInsertBranchedRunResult;
}

const insertBranchedRunIR: any = {"usedParamSet":{"branchedFromRunId":true,"branchedFromAttemptRunId":true,"branchedFromAttemptId":true,"definitionName":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"input":true,"context":true,"traceContext":true},"params":[{"name":"branchedFromRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":258,"b":275}]},{"name":"branchedFromAttemptRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":280,"b":304}]},{"name":"branchedFromAttemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":309,"b":330}]},{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":335,"b":349}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":354,"b":371}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":376,"b":385}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":390,"b":398}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":415,"b":429}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":434,"b":439}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":444,"b":451}]},{"name":"traceContext","required":false,"transform":{"type":"scalar"},"locs":[{"a":456,"b":468}]}],"statement":"INSERT INTO workflow_runs (\n  branched_from_run_id,\n  branched_from_attempt_run_id,\n  branched_from_attempt_id,\n  definition_name,\n  definition_version,\n  task_queue,\n  priority,\n  status,\n  current_step_key,\n  input,\n  context,\n  trace_context\n) VALUES (\n  :branchedFromRunId,\n  :branchedFromAttemptRunId,\n  :branchedFromAttemptId,\n  :definitionName,\n  :definitionVersion,\n  :taskQueue,\n  :priority,\n  'queued',\n  :currentStepKey,\n  :input,\n  :context,\n  :traceContext\n)\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\",\n  trace_context AS \"traceContext\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_runs (
 *   branched_from_run_id,
 *   branched_from_attempt_run_id,
 *   branched_from_attempt_id,
 *   definition_name,
 *   definition_version,
 *   task_queue,
 *   priority,
 *   status,
 *   current_step_key,
 *   input,
 *   context,
 *   trace_context
 * ) VALUES (
 *   :branchedFromRunId,
 *   :branchedFromAttemptRunId,
 *   :branchedFromAttemptId,
 *   :definitionName,
 *   :definitionVersion,
 *   :taskQueue,
 *   :priority,
 *   'queued',
 *   :currentStepKey,
 *   :input,
 *   :context,
 *   :traceContext
 * )
 * RETURNING
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt",
 *   trace_context AS "traceContext"
 * ```
 */
export const insertBranchedRun = new PreparedQuery<IInsertBranchedRunParams,IInsertBranchedRunResult>(insertBranchedRunIR);


/** 'MarkRunSuperseded' parameters type */
export interface IMarkRunSupersededParams {
  runId?: string | null | void;
  supersededByRunId?: string | null | void;
}

/** 'MarkRunSuperseded' return type */
export interface IMarkRunSupersededResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'MarkRunSuperseded' query type */
export interface IMarkRunSupersededQuery {
  params: IMarkRunSupersededParams;
  result: IMarkRunSupersededResult;
}

const markRunSupersededIR: any = {"usedParamSet":{"supersededByRunId":true,"runId":true},"params":[{"name":"supersededByRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":50,"b":67}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":102,"b":107}]}],"statement":"UPDATE workflow_runs\nSET\n  superseded_by_run_id = :supersededByRunId,\n  updated_at = now()\nWHERE id = :runId\n  AND superseded_by_run_id IS NULL\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\""};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_runs
 * SET
 *   superseded_by_run_id = :supersededByRunId,
 *   updated_at = now()
 * WHERE id = :runId
 *   AND superseded_by_run_id IS NULL
 * RETURNING
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * ```
 */
export const markRunSuperseded = new PreparedQuery<IMarkRunSupersededParams,IMarkRunSupersededResult>(markRunSupersededIR);


/** 'CompleteStandaloneStepAttempt' parameters type */
export interface ICompleteStandaloneStepAttemptParams {
  attemptId?: string | null | void;
  output?: Json | null | void;
  runId?: string | null | void;
}

/** 'CompleteStandaloneStepAttempt' return type */
export interface ICompleteStandaloneStepAttemptResult {
  attempt: number;
  completedAt: Date | null;
  createdAt: Date;
  error: Json | null;
  id: string;
  input: Json;
  kind: step_attempt_kind;
  lastHeartbeatAt: Date | null;
  output: Json | null;
  runId: string;
  startedAt: Date;
  status: step_attempt_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'CompleteStandaloneStepAttempt' query type */
export interface ICompleteStandaloneStepAttemptQuery {
  params: ICompleteStandaloneStepAttemptParams;
  result: ICompleteStandaloneStepAttemptResult;
}

const completeStandaloneStepAttemptIR: any = {"usedParamSet":{"output":true,"runId":true,"attemptId":true},"params":[{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":69,"b":75}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":154,"b":159}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":172,"b":181}]}],"statement":"UPDATE workflow_step_attempts\nSET\n  status = 'completed',\n  output = :output,\n  error = NULL,\n  completed_at = now(),\n  updated_at = now()\nWHERE run_id = :runId\n  AND id = :attemptId\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  attempt,\n  status,\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_step_attempts
 * SET
 *   status = 'completed',
 *   output = :output,
 *   error = NULL,
 *   completed_at = now(),
 *   updated_at = now()
 * WHERE run_id = :runId
 *   AND id = :attemptId
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   kind,
 *   attempt,
 *   status,
 *   input,
 *   output,
 *   error,
 *   started_at AS "startedAt",
 *   last_heartbeat_at AS "lastHeartbeatAt",
 *   completed_at AS "completedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const completeStandaloneStepAttempt = new PreparedQuery<ICompleteStandaloneStepAttemptParams,ICompleteStandaloneStepAttemptResult>(completeStandaloneStepAttemptIR);


/** 'FailStandaloneStepAttempt' parameters type */
export interface IFailStandaloneStepAttemptParams {
  attemptId?: string | null | void;
  error?: Json | null | void;
  runId?: string | null | void;
}

/** 'FailStandaloneStepAttempt' return type */
export interface IFailStandaloneStepAttemptResult {
  attempt: number;
  completedAt: Date | null;
  createdAt: Date;
  error: Json | null;
  id: string;
  input: Json;
  kind: step_attempt_kind;
  lastHeartbeatAt: Date | null;
  output: Json | null;
  runId: string;
  startedAt: Date;
  status: step_attempt_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'FailStandaloneStepAttempt' query type */
export interface IFailStandaloneStepAttemptQuery {
  params: IFailStandaloneStepAttemptParams;
  result: IFailStandaloneStepAttemptResult;
}

const failStandaloneStepAttemptIR: any = {"usedParamSet":{"error":true,"runId":true,"attemptId":true},"params":[{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":82,"b":87}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":150,"b":155}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":168,"b":177}]}],"statement":"UPDATE workflow_step_attempts\nSET\n  status = 'failed',\n  output = NULL,\n  error = :error,\n  completed_at = now(),\n  updated_at = now()\nWHERE run_id = :runId\n  AND id = :attemptId\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  attempt,\n  status,\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_step_attempts
 * SET
 *   status = 'failed',
 *   output = NULL,
 *   error = :error,
 *   completed_at = now(),
 *   updated_at = now()
 * WHERE run_id = :runId
 *   AND id = :attemptId
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   kind,
 *   attempt,
 *   status,
 *   input,
 *   output,
 *   error,
 *   started_at AS "startedAt",
 *   last_heartbeat_at AS "lastHeartbeatAt",
 *   completed_at AS "completedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const failStandaloneStepAttempt = new PreparedQuery<IFailStandaloneStepAttemptParams,IFailStandaloneStepAttemptResult>(failStandaloneStepAttemptIR);


/** 'MarkRunCompensationFailed' parameters type */
export interface IMarkRunCompensationFailedParams {
  error?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'MarkRunCompensationFailed' return type */
export interface IMarkRunCompensationFailedResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'MarkRunCompensationFailed' query type */
export interface IMarkRunCompensationFailedQuery {
  params: IMarkRunCompensationFailedParams;
  result: IMarkRunCompensationFailedResult;
}

const markRunCompensationFailedIR: any = {"usedParamSet":{"error":true,"runId":true,"stepKey":true,"eventType":true,"eventPayload":true},"params":[{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":99,"b":104}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":222,"b":227}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1286,"b":1293}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1296,"b":1305}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1308,"b":1320}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'compensation_failed',\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND status IN ('failed', 'canceled', 'compensation_failed')\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'compensation_failed',
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND status IN ('failed', 'canceled', 'compensation_failed')
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const markRunCompensationFailed = new PreparedQuery<IMarkRunCompensationFailedParams,IMarkRunCompensationFailedResult>(markRunCompensationFailedIR);


/** 'CompleteRun' parameters type */
export interface ICompleteRunParams {
  context?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  result?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'CompleteRun' return type */
export interface ICompleteRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CompleteRun' query type */
export interface ICompleteRunQuery {
  params: ICompleteRunParams;
  result: ICompleteRunResult;
}

const completeRunIR: any = {"usedParamSet":{"context":true,"result":true,"runId":true,"stepKey":true,"workerId":true,"eventType":true,"eventPayload":true},"params":[{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":120,"b":127}]},{"name":"result","required":false,"transform":{"type":"scalar"},"locs":[{"a":143,"b":149}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":311,"b":316}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":345,"b":352},{"a":1332,"b":1339}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":376,"b":384}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1342,"b":1351}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1354,"b":1366}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'completed',\n    current_step_key = NULL,\n    context = :context,\n    result = :result,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'completed',
 *     current_step_key = NULL,
 *     context = :context,
 *     result = :result,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const completeRun = new PreparedQuery<ICompleteRunParams,ICompleteRunResult>(completeRunIR);


/** 'AdvanceTaskStep' parameters type */
export interface IAdvanceTaskStepParams {
  attemptId?: string | null | void;
  context?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  nextStepKey?: string | null | void;
  output?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'AdvanceTaskStep' return type */
export interface IAdvanceTaskStepResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'AdvanceTaskStep' query type */
export interface IAdvanceTaskStepQuery {
  params: IAdvanceTaskStepParams;
  result: IAdvanceTaskStepResult;
}

const advanceTaskStepIR: any = {"usedParamSet":{"nextStepKey":true,"context":true,"runId":true,"stepKey":true,"workerId":true,"output":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":108}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":125,"b":132}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":287,"b":292}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":321,"b":328},{"a":1571,"b":1578}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":352,"b":360}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":1303,"b":1309}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1392,"b":1401}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1581,"b":1590}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1593,"b":1605}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    context = :context,\n    result = NULL,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'completed',\n    output = :output,\n    error = NULL,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :nextStepKey,
 *     context = :context,
 *     result = NULL,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'completed',
 *     output = :output,
 *     error = NULL,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const advanceTaskStep = new PreparedQuery<IAdvanceTaskStepParams,IAdvanceTaskStepResult>(advanceTaskStepIR);


/** 'OpenWait' parameters type */
export interface IOpenWaitParams {
  attemptId?: string | null | void;
  context?: Json | null | void;
  correlationKey?: string | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  expiresAt?: DateOrString | null | void;
  externalSessionId?: string | null | void;
  externalSessionKind?: string | null | void;
  output?: Json | null | void;
  payload?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'OpenWait' return type */
export interface IOpenWaitResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'OpenWait' query type */
export interface IOpenWaitQuery {
  params: IOpenWaitParams;
  result: IOpenWaitResult;
}

const openWaitIR: any = {"usedParamSet":{"stepKey":true,"context":true,"runId":true,"workerId":true,"correlationKey":true,"payload":true,"expiresAt":true,"externalSessionId":true,"externalSessionKind":true,"output":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":105},{"a":318,"b":325},{"a":1416,"b":1423},{"a":2022,"b":2029}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":122,"b":129}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":284,"b":289}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":349,"b":357}]},{"name":"correlationKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1430,"b":1444}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1463,"b":1470}]},{"name":"expiresAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":1477,"b":1486}]},{"name":"externalSessionId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1493,"b":1510},{"a":1711,"b":1728}]},{"name":"externalSessionKind","required":false,"transform":{"type":"scalar"},"locs":[{"a":1517,"b":1536},{"a":1759,"b":1778}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":1658,"b":1664}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1843,"b":1852}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":2032,"b":2041}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":2044,"b":2056}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'waiting',\n    current_step_key = :stepKey,\n    context = :context,\n    result = NULL,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_wait AS (\n  INSERT INTO workflow_waits (\n    run_id,\n    step_key,\n    correlation_key,\n    status,\n    payload,\n    expires_at,\n    external_session_id,\n    external_session_kind\n  )\n  SELECT\n    id,\n    :stepKey,\n    :correlationKey,\n    'open',\n    :payload,\n    :expiresAt,\n    :externalSessionId,\n    :externalSessionKind\n  FROM updated_run\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'completed',\n    output = :output,\n    error = NULL,\n    external_session_id = :externalSessionId,\n    external_session_kind = :externalSessionKind,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'waiting',
 *     current_step_key = :stepKey,
 *     context = :context,
 *     result = NULL,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_wait AS (
 *   INSERT INTO workflow_waits (
 *     run_id,
 *     step_key,
 *     correlation_key,
 *     status,
 *     payload,
 *     expires_at,
 *     external_session_id,
 *     external_session_kind
 *   )
 *   SELECT
 *     id,
 *     :stepKey,
 *     :correlationKey,
 *     'open',
 *     :payload,
 *     :expiresAt,
 *     :externalSessionId,
 *     :externalSessionKind
 *   FROM updated_run
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'completed',
 *     output = :output,
 *     error = NULL,
 *     external_session_id = :externalSessionId,
 *     external_session_kind = :externalSessionKind,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const openWait = new PreparedQuery<IOpenWaitParams,IOpenWaitResult>(openWaitIR);


/** 'OpenFanOutWaits' parameters type */
export interface IOpenFanOutWaitsParams {
  attemptId?: string | null | void;
  context?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  output?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  waits?: Json | null | void;
  workerId?: string | null | void;
}

/** 'OpenFanOutWaits' return type */
export interface IOpenFanOutWaitsResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'OpenFanOutWaits' query type */
export interface IOpenFanOutWaitsQuery {
  params: IOpenFanOutWaitsParams;
  result: IOpenFanOutWaitsResult;
}

const openFanOutWaitsIR: any = {"usedParamSet":{"stepKey":true,"context":true,"runId":true,"workerId":true,"waits":true,"output":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":105},{"a":318,"b":325},{"a":1377,"b":1384},{"a":2015,"b":2022}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":122,"b":129}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":284,"b":289}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":349,"b":357}]},{"name":"waits","required":false,"transform":{"type":"scalar"},"locs":[{"a":1540,"b":1545}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":1747,"b":1753}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1836,"b":1845}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":2025,"b":2034}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":2037,"b":2049}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'waiting',\n    current_step_key = :stepKey,\n    context = :context,\n    result = NULL,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_waits AS (\n  INSERT INTO workflow_waits (\n    run_id,\n    step_key,\n    correlation_key,\n    status,\n    payload,\n    expires_at\n  )\n  SELECT\n    updated_run.id,\n    :stepKey,\n    wait_entry.correlation_key,\n    'open',\n    wait_entry.payload,\n    wait_entry.expires_at\n  FROM updated_run\n  CROSS JOIN LATERAL jsonb_to_recordset(:waits::jsonb) AS wait_entry(\n    correlation_key text,\n    payload jsonb,\n    expires_at timestamptz\n  )\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'completed',\n    output = :output,\n    error = NULL,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'waiting',
 *     current_step_key = :stepKey,
 *     context = :context,
 *     result = NULL,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_waits AS (
 *   INSERT INTO workflow_waits (
 *     run_id,
 *     step_key,
 *     correlation_key,
 *     status,
 *     payload,
 *     expires_at
 *   )
 *   SELECT
 *     updated_run.id,
 *     :stepKey,
 *     wait_entry.correlation_key,
 *     'open',
 *     wait_entry.payload,
 *     wait_entry.expires_at
 *   FROM updated_run
 *   CROSS JOIN LATERAL jsonb_to_recordset(:waits::jsonb) AS wait_entry(
 *     correlation_key text,
 *     payload jsonb,
 *     expires_at timestamptz
 *   )
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'completed',
 *     output = :output,
 *     error = NULL,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const openFanOutWaits = new PreparedQuery<IOpenFanOutWaitsParams,IOpenFanOutWaitsResult>(openFanOutWaitsIR);


/** 'ScheduleRetry' parameters type */
export interface IScheduleRetryParams {
  attemptId?: string | null | void;
  availableAt?: DateOrString | null | void;
  error?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'ScheduleRetry' return type */
export interface IScheduleRetryResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ScheduleRetry' query type */
export interface IScheduleRetryQuery {
  params: IScheduleRetryParams;
  result: IScheduleRetryResult;
}

const scheduleRetryIR: any = {"usedParamSet":{"stepKey":true,"error":true,"availableAt":true,"runId":true,"workerId":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":104},{"a":308,"b":315},{"a":1554,"b":1561}]},{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":119,"b":124},{"a":1305,"b":1310}]},{"name":"availableAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":199,"b":210}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":274,"b":279}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":339,"b":347}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1375,"b":1384}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1564,"b":1573}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1576,"b":1588}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :stepKey,\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = :availableAt,\n    updated_at = now(),\n    completed_at = NULL\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'failed',\n    output = NULL,\n    error = :error,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :stepKey,
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = :availableAt,
 *     updated_at = now(),
 *     completed_at = NULL
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'failed',
 *     output = NULL,
 *     error = :error,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const scheduleRetry = new PreparedQuery<IScheduleRetryParams,IScheduleRetryResult>(scheduleRetryIR);


/** 'FailRun' parameters type */
export interface IFailRunParams {
  attemptId?: string | null | void;
  error?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'FailRun' return type */
export interface IFailRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'FailRun' query type */
export interface IFailRunQuery {
  params: IFailRunParams;
  result: IFailRunResult;
}

const failRunIR: any = {"usedParamSet":{"error":true,"runId":true,"stepKey":true,"workerId":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":86,"b":91},{"a":1266,"b":1271}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":235,"b":240}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":269,"b":276},{"a":1515,"b":1522}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":300,"b":308}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1336,"b":1345}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1525,"b":1534}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1537,"b":1549}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'failed',\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'failed',\n    output = NULL,\n    error = :error,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'failed',
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'failed',
 *     output = NULL,
 *     error = :error,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const failRun = new PreparedQuery<IFailRunParams,IFailRunResult>(failRunIR);


/** 'ScheduleSleep' parameters type */
export interface IScheduleSleepParams {
  availableAt?: DateOrString | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  nextStepKey?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'ScheduleSleep' return type */
export interface IScheduleSleepResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ScheduleSleep' query type */
export interface IScheduleSleepQuery {
  params: IScheduleSleepParams;
  result: IScheduleSleepResult;
}

const scheduleSleepIR: any = {"usedParamSet":{"nextStepKey":true,"availableAt":true,"runId":true,"stepKey":true,"workerId":true,"eventType":true,"eventPayload":true},"params":[{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":108}]},{"name":"availableAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":183,"b":194}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":233,"b":238}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":267,"b":274},{"a":1254,"b":1261}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":298,"b":306}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1264,"b":1273}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1276,"b":1288}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = :availableAt,\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :nextStepKey,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = :availableAt,
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const scheduleSleep = new PreparedQuery<IScheduleSleepParams,IScheduleSleepResult>(scheduleSleepIR);


/** 'GetOpenWaitForUpdate' parameters type */
export interface IGetOpenWaitForUpdateParams {
  correlationKey?: string | null | void;
}

/** 'GetOpenWaitForUpdate' return type */
export interface IGetOpenWaitForUpdateResult {
  correlationKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  payload: Json | null;
  resumedAt: Date | null;
  resumeOutput: Json | null;
  resumePayload: Json | null;
  runId: string;
  status: workflow_wait_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'GetOpenWaitForUpdate' query type */
export interface IGetOpenWaitForUpdateQuery {
  params: IGetOpenWaitForUpdateParams;
  result: IGetOpenWaitForUpdateResult;
}

const getOpenWaitForUpdateIR: any = {"usedParamSet":{"correlationKey":true},"params":[{"name":"correlationKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":446,"b":460}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_waits\nWHERE correlation_key = :correlationKey\nFOR UPDATE"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   status,
 *   payload,
 *   resume_payload AS "resumePayload",
 *   resume_output AS "resumeOutput",
 *   expires_at AS "expiresAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   resumed_at AS "resumedAt",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_waits
 * WHERE correlation_key = :correlationKey
 * FOR UPDATE
 * ```
 */
export const getOpenWaitForUpdate = new PreparedQuery<IGetOpenWaitForUpdateParams,IGetOpenWaitForUpdateResult>(getOpenWaitForUpdateIR);


/** 'GetRunByIdForUpdate' parameters type */
export interface IGetRunByIdForUpdateParams {
  runId?: string | null | void;
}

/** 'GetRunByIdForUpdate' return type */
export interface IGetRunByIdForUpdateResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'GetRunByIdForUpdate' query type */
export interface IGetRunByIdForUpdateQuery {
  params: IGetRunByIdForUpdateParams;
  result: IGetRunByIdForUpdateResult;
}

const getRunByIdForUpdateIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":895,"b":900}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\",\n  trace_context AS \"traceContext\"\nFROM workflow_runs\nWHERE id = :runId\nFOR UPDATE"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt",
 *   trace_context AS "traceContext"
 * FROM workflow_runs
 * WHERE id = :runId
 * FOR UPDATE
 * ```
 */
export const getRunByIdForUpdate = new PreparedQuery<IGetRunByIdForUpdateParams,IGetRunByIdForUpdateResult>(getRunByIdForUpdateIR);


/** 'CompleteWaitResume' parameters type */
export interface ICompleteWaitResumeParams {
  context?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  nextStepKey?: string | null | void;
  output?: Json | null | void;
  resumePayload?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  waitId?: string | null | void;
}

/** 'CompleteWaitResume' return type */
export interface ICompleteWaitResumeResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CompleteWaitResume' query type */
export interface ICompleteWaitResumeQuery {
  params: ICompleteWaitResumeParams;
  result: ICompleteWaitResumeResult;
}

const completeWaitResumeIR: any = {"usedParamSet":{"resumePayload":true,"output":true,"waitId":true,"nextStepKey":true,"context":true,"runId":true,"stepKey":true,"eventType":true,"eventPayload":true},"params":[{"name":"resumePayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":111}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":134,"b":140}]},{"name":"waitId","required":false,"transform":{"type":"scalar"},"locs":[{"a":203,"b":209}]},{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":345,"b":356}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":373,"b":380}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":516,"b":521}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":577,"b":584},{"a":1542,"b":1549}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1552,"b":1561}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1564,"b":1576}]}],"statement":"WITH updated_wait AS (\n  UPDATE workflow_waits\n  SET\n    status = 'resumed',\n    resume_payload = :resumePayload,\n    resume_output = :output,\n    resumed_at = now(),\n    updated_at = now()\n  WHERE id = :waitId\n    AND status = 'open'\n  RETURNING id\n), updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    context = :context,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND status = 'waiting'\n    AND current_step_key = :stepKey\n    AND EXISTS (SELECT 1 FROM updated_wait)\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_wait AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = 'resumed',
 *     resume_payload = :resumePayload,
 *     resume_output = :output,
 *     resumed_at = now(),
 *     updated_at = now()
 *   WHERE id = :waitId
 *     AND status = 'open'
 *   RETURNING id
 * ), updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :nextStepKey,
 *     context = :context,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND status = 'waiting'
 *     AND current_step_key = :stepKey
 *     AND EXISTS (SELECT 1 FROM updated_wait)
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const completeWaitResume = new PreparedQuery<ICompleteWaitResumeParams,ICompleteWaitResumeResult>(completeWaitResumeIR);


/** 'CompleteExpiredWaitTransition' parameters type */
export interface ICompleteExpiredWaitTransitionParams {
  context?: Json | null | void;
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  nextStepKey?: string | null | void;
  output?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  waitId?: string | null | void;
}

/** 'CompleteExpiredWaitTransition' return type */
export interface ICompleteExpiredWaitTransitionResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CompleteExpiredWaitTransition' query type */
export interface ICompleteExpiredWaitTransitionQuery {
  params: ICompleteExpiredWaitTransitionParams;
  result: ICompleteExpiredWaitTransitionResult;
}

const completeExpiredWaitTransitionIR: any = {"usedParamSet":{"nextStepKey":true,"context":true,"output":true,"runId":true,"stepKey":true,"waitId":true,"eventType":true,"eventPayload":true},"params":[{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":108}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":125,"b":132}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":148,"b":154},{"a":1237,"b":1243}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":290,"b":295}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":351,"b":358},{"a":1481,"b":1488}]},{"name":"waitId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1282,"b":1288}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1491,"b":1500}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1503,"b":1515}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    context = :context,\n    result = :output,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND status = 'waiting'\n    AND current_step_key = :stepKey\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_wait AS (\n  UPDATE workflow_waits\n  SET\n    resume_output = :output,\n    updated_at = now()\n  WHERE id = :waitId\n    AND status = 'expired'\n    AND EXISTS (SELECT 1 FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n  WHERE EXISTS (SELECT 1 FROM updated_wait)\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :nextStepKey,
 *     context = :context,
 *     result = :output,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND status = 'waiting'
 *     AND current_step_key = :stepKey
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_wait AS (
 *   UPDATE workflow_waits
 *   SET
 *     resume_output = :output,
 *     updated_at = now()
 *   WHERE id = :waitId
 *     AND status = 'expired'
 *     AND EXISTS (SELECT 1 FROM updated_run)
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 *   WHERE EXISTS (SELECT 1 FROM updated_wait)
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const completeExpiredWaitTransition = new PreparedQuery<ICompleteExpiredWaitTransitionParams,ICompleteExpiredWaitTransitionResult>(completeExpiredWaitTransitionIR);


/** 'ExtendLease' parameters type */
export interface IExtendLeaseParams {
  attemptId?: string | null | void;
  leaseMs?: number | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'ExtendLease' return type */
export interface IExtendLeaseResult {
  ok: number | null;
}

/** 'ExtendLease' query type */
export interface IExtendLeaseQuery {
  params: IExtendLeaseParams;
  result: IExtendLeaseResult;
}

const extendLeaseIR: any = {"usedParamSet":{"leaseMs":true,"runId":true,"stepKey":true,"workerId":true,"attemptId":true},"params":[{"name":"leaseMs","required":false,"transform":{"type":"scalar"},"locs":[{"a":83,"b":90}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":157,"b":162}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":191,"b":198}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":222,"b":230}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":410,"b":419}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING id\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    last_heartbeat_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n)\nSELECT CASE WHEN EXISTS (SELECT 1 FROM updated_attempt) THEN 1 ELSE 0 END::int AS ok"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING id
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     last_heartbeat_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *   RETURNING id
 * )
 * SELECT CASE WHEN EXISTS (SELECT 1 FROM updated_attempt) THEN 1 ELSE 0 END::int AS ok
 * ```
 */
export const extendLease = new PreparedQuery<IExtendLeaseParams,IExtendLeaseResult>(extendLeaseIR);


/** 'RecordExternalHeartbeat' parameters type */
export interface IRecordExternalHeartbeatParams {
  externalSessionId?: string | null | void;
  leaseMs?: number | null | void;
  payload?: Json | null | void;
}

/** 'RecordExternalHeartbeat' return type */
export interface IRecordExternalHeartbeatResult {
  attemptId: string | null;
  runId: string | null;
  status: string | null;
  stepKey: string | null;
}

/** 'RecordExternalHeartbeat' query type */
export interface IRecordExternalHeartbeatQuery {
  params: IRecordExternalHeartbeatParams;
  result: IRecordExternalHeartbeatResult;
}

const recordExternalHeartbeatIR: any = {"usedParamSet":{"externalSessionId":true,"leaseMs":true,"payload":true},"params":[{"name":"externalSessionId","required":false,"transform":{"type":"scalar"},"locs":[{"a":116,"b":133},{"a":751,"b":768}]},{"name":"leaseMs","required":false,"transform":{"type":"scalar"},"locs":[{"a":290,"b":297}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":954,"b":961}]}],"statement":"WITH locked_wait AS (\n  SELECT\n    id,\n    run_id,\n    step_key\n  FROM workflow_waits\n  WHERE external_session_id = :externalSessionId\n    AND status = 'open'\n  ORDER BY created_at DESC\n  LIMIT 1\n  FOR UPDATE\n), updated_run AS (\n  UPDATE workflow_runs\n  SET\n    lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),\n    updated_at = now()\n  WHERE id IN (SELECT run_id FROM locked_wait)\n    AND status = 'waiting'\n    AND current_step_key IN (SELECT step_key FROM locked_wait)\n  RETURNING id\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    last_heartbeat_at = now(),\n    updated_at = now()\n  WHERE run_id IN (SELECT id FROM updated_run)\n    AND step_key IN (SELECT step_key FROM locked_wait)\n    AND external_session_id = :externalSessionId\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, (SELECT step_key FROM locked_wait), 'step.external_heartbeat', :payload\n  FROM updated_run\n  WHERE EXISTS (SELECT 1 FROM updated_attempt)\n)\nSELECT\n  CASE\n    WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'\n    WHEN NOT EXISTS (SELECT 1 FROM updated_attempt) THEN 'stale'\n    ELSE 'recorded'\n  END AS status,\n  (SELECT id FROM updated_run) AS \"runId\",\n  (SELECT step_key FROM locked_wait) AS \"stepKey\",\n  (SELECT id FROM updated_attempt) AS \"attemptId\""};

/**
 * Query generated from SQL:
 * ```
 * WITH locked_wait AS (
 *   SELECT
 *     id,
 *     run_id,
 *     step_key
 *   FROM workflow_waits
 *   WHERE external_session_id = :externalSessionId
 *     AND status = 'open'
 *   ORDER BY created_at DESC
 *   LIMIT 1
 *   FOR UPDATE
 * ), updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),
 *     updated_at = now()
 *   WHERE id IN (SELECT run_id FROM locked_wait)
 *     AND status = 'waiting'
 *     AND current_step_key IN (SELECT step_key FROM locked_wait)
 *   RETURNING id
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     last_heartbeat_at = now(),
 *     updated_at = now()
 *   WHERE run_id IN (SELECT id FROM updated_run)
 *     AND step_key IN (SELECT step_key FROM locked_wait)
 *     AND external_session_id = :externalSessionId
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, (SELECT step_key FROM locked_wait), 'step.external_heartbeat', :payload
 *   FROM updated_run
 *   WHERE EXISTS (SELECT 1 FROM updated_attempt)
 * )
 * SELECT
 *   CASE
 *     WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'
 *     WHEN NOT EXISTS (SELECT 1 FROM updated_attempt) THEN 'stale'
 *     ELSE 'recorded'
 *   END AS status,
 *   (SELECT id FROM updated_run) AS "runId",
 *   (SELECT step_key FROM locked_wait) AS "stepKey",
 *   (SELECT id FROM updated_attempt) AS "attemptId"
 * ```
 */
export const recordExternalHeartbeat = new PreparedQuery<IRecordExternalHeartbeatParams,IRecordExternalHeartbeatResult>(recordExternalHeartbeatIR);


/** 'ListOpenExternalSessions' parameters type */
export interface IListOpenExternalSessionsParams {
  runId?: string | null | void;
}

/** 'ListOpenExternalSessions' return type */
export interface IListOpenExternalSessionsResult {
  correlationKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  payload: Json | null;
  resumedAt: Date | null;
  resumeOutput: Json | null;
  resumePayload: Json | null;
  runId: string;
  status: workflow_wait_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'ListOpenExternalSessions' query type */
export interface IListOpenExternalSessionsQuery {
  params: IListOpenExternalSessionsParams;
  result: IListOpenExternalSessionsResult;
}

const listOpenExternalSessionsIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":437,"b":442}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_waits\nWHERE run_id = :runId\n  AND status = 'open'\n  AND external_session_id IS NOT NULL\nORDER BY created_at ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   status,
 *   payload,
 *   resume_payload AS "resumePayload",
 *   resume_output AS "resumeOutput",
 *   expires_at AS "expiresAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   resumed_at AS "resumedAt",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_waits
 * WHERE run_id = :runId
 *   AND status = 'open'
 *   AND external_session_id IS NOT NULL
 * ORDER BY created_at ASC
 * ```
 */
export const listOpenExternalSessions = new PreparedQuery<IListOpenExternalSessionsParams,IListOpenExternalSessionsResult>(listOpenExternalSessionsIR);


/** 'ListStepWaits' parameters type */
export interface IListStepWaitsParams {
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'ListStepWaits' return type */
export interface IListStepWaitsResult {
  correlationKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  payload: Json | null;
  resumedAt: Date | null;
  resumeOutput: Json | null;
  resumePayload: Json | null;
  runId: string;
  status: workflow_wait_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'ListStepWaits' query type */
export interface IListStepWaitsQuery {
  params: IListStepWaitsParams;
  result: IListStepWaitsResult;
}

const listStepWaitsIR: any = {"usedParamSet":{"runId":true,"stepKey":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":437,"b":442}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":461,"b":468}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_waits\nWHERE run_id = :runId\n  AND step_key = :stepKey\nORDER BY created_at ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   status,
 *   payload,
 *   resume_payload AS "resumePayload",
 *   resume_output AS "resumeOutput",
 *   expires_at AS "expiresAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   resumed_at AS "resumedAt",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_waits
 * WHERE run_id = :runId
 *   AND step_key = :stepKey
 * ORDER BY created_at ASC
 * ```
 */
export const listStepWaits = new PreparedQuery<IListStepWaitsParams,IListStepWaitsResult>(listStepWaitsIR);


/** 'RecordExternalSessionEvent' parameters type */
export interface IRecordExternalSessionEventParams {
  data?: Json | null | void;
  eventType?: string | null | void;
  externalSessionId?: string | null | void;
  type?: string | null | void;
}

/** 'RecordExternalSessionEvent' return type */
export interface IRecordExternalSessionEventResult {
  attemptId: string | null;
  eventId: string | null;
  runId: string | null;
  status: string | null;
  stepKey: string | null;
}

/** 'RecordExternalSessionEvent' query type */
export interface IRecordExternalSessionEventQuery {
  params: IRecordExternalSessionEventParams;
  result: IRecordExternalSessionEventResult;
}

const recordExternalSessionEventIR: any = {"usedParamSet":{"externalSessionId":true,"eventType":true,"type":true,"data":true},"params":[{"name":"externalSessionId","required":false,"transform":{"type":"scalar"},"locs":[{"a":116,"b":133},{"a":594,"b":611}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":804,"b":813}]},{"name":"type","required":false,"transform":{"type":"scalar"},"locs":[{"a":860,"b":864}]},{"name":"data","required":false,"transform":{"type":"scalar"},"locs":[{"a":893,"b":897}]}],"statement":"WITH locked_wait AS (\n  SELECT\n    id,\n    run_id,\n    step_key\n  FROM workflow_waits\n  WHERE external_session_id = :externalSessionId\n    AND status = 'open'\n  ORDER BY created_at DESC\n  LIMIT 1\n  FOR UPDATE\n), active_run AS (\n  SELECT id\n  FROM workflow_runs\n  WHERE id IN (SELECT run_id FROM locked_wait)\n    AND status = 'waiting'\n    AND current_step_key IN (SELECT step_key FROM locked_wait)\n), active_attempt AS (\n  SELECT id\n  FROM workflow_step_attempts\n  WHERE run_id IN (SELECT id FROM active_run)\n    AND step_key IN (SELECT step_key FROM locked_wait)\n    AND external_session_id = :externalSessionId\n  ORDER BY created_at DESC\n  LIMIT 1\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT\n    id,\n    (SELECT step_key FROM locked_wait),\n    :eventType,\n    jsonb_build_object(\n      'type',\n      :type::text,\n      'data',\n      :data::jsonb,\n      'stepKey',\n      (SELECT step_key FROM locked_wait),\n      'stepAttemptId',\n      (SELECT id FROM active_attempt)\n    )\n  FROM active_run\n  WHERE EXISTS (SELECT 1 FROM active_attempt)\n  RETURNING id\n)\nSELECT\n  CASE\n    WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'\n    WHEN NOT EXISTS (SELECT 1 FROM active_attempt) THEN 'stale'\n    ELSE 'recorded'\n  END AS status,\n  (SELECT id FROM active_run) AS \"runId\",\n  (SELECT step_key FROM locked_wait) AS \"stepKey\",\n  (SELECT id FROM active_attempt) AS \"attemptId\",\n  (SELECT id FROM inserted_event) AS \"eventId\""};

/**
 * Query generated from SQL:
 * ```
 * WITH locked_wait AS (
 *   SELECT
 *     id,
 *     run_id,
 *     step_key
 *   FROM workflow_waits
 *   WHERE external_session_id = :externalSessionId
 *     AND status = 'open'
 *   ORDER BY created_at DESC
 *   LIMIT 1
 *   FOR UPDATE
 * ), active_run AS (
 *   SELECT id
 *   FROM workflow_runs
 *   WHERE id IN (SELECT run_id FROM locked_wait)
 *     AND status = 'waiting'
 *     AND current_step_key IN (SELECT step_key FROM locked_wait)
 * ), active_attempt AS (
 *   SELECT id
 *   FROM workflow_step_attempts
 *   WHERE run_id IN (SELECT id FROM active_run)
 *     AND step_key IN (SELECT step_key FROM locked_wait)
 *     AND external_session_id = :externalSessionId
 *   ORDER BY created_at DESC
 *   LIMIT 1
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT
 *     id,
 *     (SELECT step_key FROM locked_wait),
 *     :eventType,
 *     jsonb_build_object(
 *       'type',
 *       :type::text,
 *       'data',
 *       :data::jsonb,
 *       'stepKey',
 *       (SELECT step_key FROM locked_wait),
 *       'stepAttemptId',
 *       (SELECT id FROM active_attempt)
 *     )
 *   FROM active_run
 *   WHERE EXISTS (SELECT 1 FROM active_attempt)
 *   RETURNING id
 * )
 * SELECT
 *   CASE
 *     WHEN NOT EXISTS (SELECT 1 FROM locked_wait) THEN 'missing'
 *     WHEN NOT EXISTS (SELECT 1 FROM active_attempt) THEN 'stale'
 *     ELSE 'recorded'
 *   END AS status,
 *   (SELECT id FROM active_run) AS "runId",
 *   (SELECT step_key FROM locked_wait) AS "stepKey",
 *   (SELECT id FROM active_attempt) AS "attemptId",
 *   (SELECT id FROM inserted_event) AS "eventId"
 * ```
 */
export const recordExternalSessionEvent = new PreparedQuery<IRecordExternalSessionEventParams,IRecordExternalSessionEventResult>(recordExternalSessionEventIR);


/** 'InsertUsage' parameters type */
export interface IInsertUsageParams {
  amount?: NumberOrString | null | void;
  costUsd?: NumberOrString | null | void;
  dimension?: string | null | void;
  resource?: string | null | void;
  runId?: string | null | void;
  stepAttemptId?: string | null | void;
}

/** 'InsertUsage' return type */
export interface IInsertUsageResult {
  amount: string;
  costUsd: string | null;
  dimension: string | null;
  id: string;
  recordedAt: Date;
  resource: string;
  runId: string;
  stepAttemptId: string | null;
}

/** 'InsertUsage' query type */
export interface IInsertUsageQuery {
  params: IInsertUsageParams;
  result: IInsertUsageResult;
}

const insertUsageIR: any = {"usedParamSet":{"runId":true,"stepAttemptId":true,"resource":true,"amount":true,"costUsd":true,"dimension":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":121,"b":126}]},{"name":"stepAttemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":131,"b":144}]},{"name":"resource","required":false,"transform":{"type":"scalar"},"locs":[{"a":149,"b":157}]},{"name":"amount","required":false,"transform":{"type":"scalar"},"locs":[{"a":162,"b":168}]},{"name":"costUsd","required":false,"transform":{"type":"scalar"},"locs":[{"a":173,"b":180}]},{"name":"dimension","required":false,"transform":{"type":"scalar"},"locs":[{"a":185,"b":194}]}],"statement":"INSERT INTO workflow_run_usage (\n  run_id,\n  step_attempt_id,\n  resource,\n  amount,\n  cost_usd,\n  dimension\n) VALUES (\n  :runId,\n  :stepAttemptId,\n  :resource,\n  :amount,\n  :costUsd,\n  :dimension\n)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_attempt_id AS \"stepAttemptId\",\n  resource,\n  amount,\n  cost_usd AS \"costUsd\",\n  dimension,\n  recorded_at AS \"recordedAt\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_run_usage (
 *   run_id,
 *   step_attempt_id,
 *   resource,
 *   amount,
 *   cost_usd,
 *   dimension
 * ) VALUES (
 *   :runId,
 *   :stepAttemptId,
 *   :resource,
 *   :amount,
 *   :costUsd,
 *   :dimension
 * )
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_attempt_id AS "stepAttemptId",
 *   resource,
 *   amount,
 *   cost_usd AS "costUsd",
 *   dimension,
 *   recorded_at AS "recordedAt"
 * ```
 */
export const insertUsage = new PreparedQuery<IInsertUsageParams,IInsertUsageResult>(insertUsageIR);


/** 'GetUsageTotals' parameters type */
export interface IGetUsageTotalsParams {
  resource?: string | null | void;
  runId?: string | null | void;
}

/** 'GetUsageTotals' return type */
export interface IGetUsageTotalsResult {
  costUsd: string | null;
  resourceAmount: string | null;
}

/** 'GetUsageTotals' query type */
export interface IGetUsageTotalsQuery {
  params: IGetUsageTotalsParams;
  result: IGetUsageTotalsResult;
}

const getUsageTotalsIR: any = {"usedParamSet":{"resource":true,"runId":true},"params":[{"name":"resource","required":false,"transform":{"type":"scalar"},"locs":[{"a":55,"b":63}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":184,"b":189}]}],"statement":"SELECT\n  COALESCE(SUM(amount) FILTER (WHERE resource = :resource), 0)::text AS \"resourceAmount\",\n  COALESCE(SUM(cost_usd), 0)::text AS \"costUsd\"\nFROM workflow_run_usage\nWHERE run_id = :runId"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   COALESCE(SUM(amount) FILTER (WHERE resource = :resource), 0)::text AS "resourceAmount",
 *   COALESCE(SUM(cost_usd), 0)::text AS "costUsd"
 * FROM workflow_run_usage
 * WHERE run_id = :runId
 * ```
 */
export const getUsageTotals = new PreparedQuery<IGetUsageTotalsParams,IGetUsageTotalsResult>(getUsageTotalsIR);


/** 'GetRunUsage' parameters type */
export interface IGetRunUsageParams {
  runId?: string | null | void;
}

/** 'GetRunUsage' return type */
export interface IGetRunUsageResult {
  amount: string;
  costUsd: string | null;
  dimension: string | null;
  id: string;
  recordedAt: Date;
  resource: string;
  runId: string;
  stepAttemptId: string | null;
}

/** 'GetRunUsage' query type */
export interface IGetRunUsageQuery {
  params: IGetRunUsageParams;
  result: IGetRunUsageResult;
}

const getRunUsageIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":201,"b":206}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_attempt_id AS \"stepAttemptId\",\n  resource,\n  amount,\n  cost_usd AS \"costUsd\",\n  dimension,\n  recorded_at AS \"recordedAt\"\nFROM workflow_run_usage\nWHERE run_id = :runId\nORDER BY recorded_at ASC, id ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_attempt_id AS "stepAttemptId",
 *   resource,
 *   amount,
 *   cost_usd AS "costUsd",
 *   dimension,
 *   recorded_at AS "recordedAt"
 * FROM workflow_run_usage
 * WHERE run_id = :runId
 * ORDER BY recorded_at ASC, id ASC
 * ```
 */
export const getRunUsage = new PreparedQuery<IGetRunUsageParams,IGetRunUsageResult>(getRunUsageIR);


/** 'ExhaustRunBudget' parameters type */
export interface IExhaustRunBudgetParams {
  error?: Json | null | void;
  runId?: string | null | void;
  stepAttemptId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'ExhaustRunBudget' return type */
export interface IExhaustRunBudgetResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'ExhaustRunBudget' query type */
export interface IExhaustRunBudgetQuery {
  params: IExhaustRunBudgetParams;
  result: IExhaustRunBudgetResult;
}

const exhaustRunBudgetIR: any = {"usedParamSet":{"error":true,"runId":true,"stepAttemptId":true,"stepKey":true},"params":[{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":125,"b":130},{"a":1322,"b":1327},{"a":1793,"b":1798}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":274,"b":279}]},{"name":"stepAttemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1392,"b":1405}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1759,"b":1766}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'exhausted_budget',\n    current_step_key = NULL,\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND status NOT IN ('completed', 'failed', 'compensation_failed', 'canceled', 'exhausted_budget')\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\",\n    trace_context AS \"traceContext\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'failed',\n    error = :error,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :stepAttemptId\n    AND run_id IN (SELECT id FROM updated_run)\n    AND status = 'started'\n), canceled_waits AS (\n  UPDATE workflow_waits\n  SET\n    status = 'canceled',\n    updated_at = now()\n  WHERE run_id IN (SELECT id FROM updated_run)\n    AND status = 'open'\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'run.exhausted_budget', :error\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'exhausted_budget',
 *     current_step_key = NULL,
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND status NOT IN ('completed', 'failed', 'compensation_failed', 'canceled', 'exhausted_budget')
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt",
 *     trace_context AS "traceContext"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'failed',
 *     error = :error,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :stepAttemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 *     AND status = 'started'
 * ), canceled_waits AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = 'canceled',
 *     updated_at = now()
 *   WHERE run_id IN (SELECT id FROM updated_run)
 *     AND status = 'open'
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'run.exhausted_budget', :error
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const exhaustRunBudget = new PreparedQuery<IExhaustRunBudgetParams,IExhaustRunBudgetResult>(exhaustRunBudgetIR);


/** 'CountOpenWaits' parameters type */
export type ICountOpenWaitsParams = void;

/** 'CountOpenWaits' return type */
export interface ICountOpenWaitsResult {
  waitCount: number | null;
}

/** 'CountOpenWaits' query type */
export interface ICountOpenWaitsQuery {
  params: ICountOpenWaitsParams;
  result: ICountOpenWaitsResult;
}

const countOpenWaitsIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT COUNT(*)::int AS \"waitCount\"\nFROM workflow_waits\nWHERE status = 'open'"};

/**
 * Query generated from SQL:
 * ```
 * SELECT COUNT(*)::int AS "waitCount"
 * FROM workflow_waits
 * WHERE status = 'open'
 * ```
 */
export const countOpenWaits = new PreparedQuery<ICountOpenWaitsParams,ICountOpenWaitsResult>(countOpenWaitsIR);


/** 'ExpireOpenWaits' parameters type */
export interface IExpireOpenWaitsParams {
  limit?: NumberOrString | null | void;
}

/** 'ExpireOpenWaits' return type */
export interface IExpireOpenWaitsResult {
  correlationKey: string;
  expiresAt: Date | null;
  id: string;
  payload: Json | null;
  runId: string;
  stepKey: string;
}

/** 'ExpireOpenWaits' query type */
export interface IExpireOpenWaitsQuery {
  params: IExpireOpenWaitsParams;
  result: IExpireOpenWaitsResult;
}

const expireOpenWaitsIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":286,"b":291}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  payload,\n  expires_at AS \"expiresAt\"\nFROM workflow_waits\nWHERE status = 'open'\n  AND expires_at IS NOT NULL\n  AND expires_at < now()\nORDER BY expires_at ASC\nFOR UPDATE SKIP LOCKED\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   payload,
 *   expires_at AS "expiresAt"
 * FROM workflow_waits
 * WHERE status = 'open'
 *   AND expires_at IS NOT NULL
 *   AND expires_at < now()
 * ORDER BY expires_at ASC
 * FOR UPDATE SKIP LOCKED
 * LIMIT :limit
 * ```
 */
export const expireOpenWaits = new PreparedQuery<IExpireOpenWaitsParams,IExpireOpenWaitsResult>(expireOpenWaitsIR);


/** 'FailExpiredWaitRun' parameters type */
export interface IFailExpiredWaitRunParams {
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'FailExpiredWaitRun' return type */
export interface IFailExpiredWaitRunResult {
  runId: string;
}

/** 'FailExpiredWaitRun' query type */
export interface IFailExpiredWaitRunQuery {
  params: IFailExpiredWaitRunParams;
  result: IFailExpiredWaitRunResult;
}

const failExpiredWaitRunIR: any = {"usedParamSet":{"runId":true,"stepKey":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":279,"b":284}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":313,"b":320},{"a":470,"b":477}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'failed',\n    error = jsonb_build_object('message', 'Wait step expired'),\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND status = 'waiting'\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'wait.expired', '{}'::jsonb\n  FROM updated_run\n)\nSELECT\n  id AS \"runId\"\nFROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'failed',
 *     error = jsonb_build_object('message', 'Wait step expired'),
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND status = 'waiting'
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'wait.expired', '{}'::jsonb
 *   FROM updated_run
 * )
 * SELECT
 *   id AS "runId"
 * FROM updated_run
 * ```
 */
export const failExpiredWaitRun = new PreparedQuery<IFailExpiredWaitRunParams,IFailExpiredWaitRunResult>(failExpiredWaitRunIR);


/** 'CreateSignal' parameters type */
export interface ICreateSignalParams {
  payload?: Json | null | void;
  runId?: string | null | void;
  signalName?: string | null | void;
}

/** 'CreateSignal' return type */
export interface ICreateSignalResult {
  runId: string;
}

/** 'CreateSignal' query type */
export interface ICreateSignalQuery {
  params: ICreateSignalParams;
  result: ICreateSignalResult;
}

const createSignalIR: any = {"usedParamSet":{"runId":true,"signalName":true,"payload":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":67,"b":72},{"a":499,"b":504},{"a":623,"b":628}]},{"name":"signalName","required":false,"transform":{"type":"scalar"},"locs":[{"a":189,"b":199},{"a":689,"b":699}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":202,"b":209}]}],"statement":"WITH target_run AS (\n  SELECT id\n  FROM workflow_runs\n  WHERE id = :runId\n), inserted_signal AS (\n  INSERT INTO workflow_signals (\n    run_id,\n    signal_name,\n    payload\n  )\n  SELECT id, :signalName, :payload\n  FROM target_run\n  RETURNING run_id AS \"runId\"\n), updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = CASE WHEN status = 'waiting' THEN 'queued' ELSE status END,\n    available_at = CASE WHEN status = 'waiting' THEN now() ELSE available_at END,\n    updated_at = now()\n  WHERE id = :runId\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT :runId, NULL, 'signal.received', jsonb_build_object('signalName', :signalName)\n  FROM inserted_signal\n)\nSELECT \"runId\" FROM inserted_signal"};

/**
 * Query generated from SQL:
 * ```
 * WITH target_run AS (
 *   SELECT id
 *   FROM workflow_runs
 *   WHERE id = :runId
 * ), inserted_signal AS (
 *   INSERT INTO workflow_signals (
 *     run_id,
 *     signal_name,
 *     payload
 *   )
 *   SELECT id, :signalName, :payload
 *   FROM target_run
 *   RETURNING run_id AS "runId"
 * ), updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = CASE WHEN status = 'waiting' THEN 'queued' ELSE status END,
 *     available_at = CASE WHEN status = 'waiting' THEN now() ELSE available_at END,
 *     updated_at = now()
 *   WHERE id = :runId
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT :runId, NULL, 'signal.received', jsonb_build_object('signalName', :signalName)
 *   FROM inserted_signal
 * )
 * SELECT "runId" FROM inserted_signal
 * ```
 */
export const createSignal = new PreparedQuery<ICreateSignalParams,ICreateSignalResult>(createSignalIR);


/** 'ConsumeSignal' parameters type */
export interface IConsumeSignalParams {
  runId?: string | null | void;
  signalName?: string | null | void;
}

/** 'ConsumeSignal' return type */
export interface IConsumeSignalResult {
  consumedAt: Date | null;
  createdAt: Date;
  id: string;
  payload: Json | null;
  runId: string;
  signalName: string;
  updatedAt: Date;
}

/** 'ConsumeSignal' query type */
export interface IConsumeSignalQuery {
  params: IConsumeSignalParams;
  result: IConsumeSignalResult;
}

const consumeSignalIR: any = {"usedParamSet":{"runId":true,"signalName":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":73,"b":78}]},{"name":"signalName","required":false,"transform":{"type":"scalar"},"locs":[{"a":102,"b":112}]}],"statement":"WITH candidate AS (\n  SELECT id\n  FROM workflow_signals\n  WHERE run_id = :runId\n    AND signal_name = :signalName\n    AND consumed_at IS NULL\n  ORDER BY created_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT 1\n)\nUPDATE workflow_signals\nSET\n  consumed_at = now(),\n  updated_at = now()\nWHERE id IN (SELECT id FROM candidate)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  signal_name AS \"signalName\",\n  payload,\n  consumed_at AS \"consumedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * WITH candidate AS (
 *   SELECT id
 *   FROM workflow_signals
 *   WHERE run_id = :runId
 *     AND signal_name = :signalName
 *     AND consumed_at IS NULL
 *   ORDER BY created_at ASC
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT 1
 * )
 * UPDATE workflow_signals
 * SET
 *   consumed_at = now(),
 *   updated_at = now()
 * WHERE id IN (SELECT id FROM candidate)
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   signal_name AS "signalName",
 *   payload,
 *   consumed_at AS "consumedAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const consumeSignal = new PreparedQuery<IConsumeSignalParams,IConsumeSignalResult>(consumeSignalIR);


/** 'ListRuns' parameters type */
export interface IListRunsParams {
  limit?: NumberOrString | null | void;
  parentRunId?: string | null | void;
  search?: string | null | void;
  status?: string | null | void;
  taskQueue?: string | null | void;
  workflowName?: string | null | void;
}

/** 'ListRuns' return type */
export interface IListRunsResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ListRuns' query type */
export interface IListRunsQuery {
  params: IListRunsParams;
  result: IListRunsResult;
}

const listRunsIR: any = {"usedParamSet":{"workflowName":true,"status":true,"taskQueue":true,"parentRunId":true,"search":true,"limit":true},"params":[{"name":"workflowName","required":false,"transform":{"type":"scalar"},"locs":[{"a":856,"b":868},{"a":905,"b":917}]},{"name":"status","required":false,"transform":{"type":"scalar"},"locs":[{"a":927,"b":933},{"a":967,"b":973}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":983,"b":992},{"a":1024,"b":1033}]},{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1043,"b":1054},{"a":1089,"b":1100}]},{"name":"search","required":false,"transform":{"type":"scalar"},"locs":[{"a":1115,"b":1121},{"a":1166,"b":1172},{"a":1217,"b":1223},{"a":1283,"b":1289}]},{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":1350,"b":1355}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE (:workflowName::text IS NULL OR definition_name = :workflowName)\n  AND (:status::text IS NULL OR status::text = :status)\n  AND (:taskQueue::text IS NULL OR task_queue = :taskQueue)\n  AND (:parentRunId::uuid IS NULL OR parent_run_id = :parentRunId)\n  AND (\n    :search::text IS NULL\n    OR id::text ILIKE '%' || :search || '%'\n    OR definition_name ILIKE '%' || :search || '%'\n    OR COALESCE(current_step_key, '') ILIKE '%' || :search || '%'\n  )\nORDER BY updated_at DESC, created_at DESC\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE (:workflowName::text IS NULL OR definition_name = :workflowName)
 *   AND (:status::text IS NULL OR status::text = :status)
 *   AND (:taskQueue::text IS NULL OR task_queue = :taskQueue)
 *   AND (:parentRunId::uuid IS NULL OR parent_run_id = :parentRunId)
 *   AND (
 *     :search::text IS NULL
 *     OR id::text ILIKE '%' || :search || '%'
 *     OR definition_name ILIKE '%' || :search || '%'
 *     OR COALESCE(current_step_key, '') ILIKE '%' || :search || '%'
 *   )
 * ORDER BY updated_at DESC, created_at DESC
 * LIMIT :limit
 * ```
 */
export const listRuns = new PreparedQuery<IListRunsParams,IListRunsResult>(listRunsIR);


/** 'ListRunLineage' parameters type */
export interface IListRunLineageParams {
  runId?: string | null | void;
}

/** 'ListRunLineage' return type */
export interface IListRunLineageResult {
  availableAt: Date | null;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json | null;
  continuedFromRunId: string | null;
  createdAt: Date | null;
  currentStepKey: string | null;
  definitionName: string | null;
  definitionVersion: number | null;
  error: Json | null;
  id: string | null;
  input: Json | null;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number | null;
  result: Json | null;
  status: workflow_run_status | null;
  supersededByRunId: string | null;
  taskQueue: string | null;
  updatedAt: Date | null;
}

/** 'ListRunLineage' query type */
export interface IListRunLineageQuery {
  params: IListRunLineageParams;
  result: IListRunLineageResult;
}

const listRunLineageIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":930,"b":935}]}],"statement":"WITH RECURSIVE lineage AS (\n  SELECT\n    workflow_runs.id,\n    workflow_runs.parent_run_id,\n    workflow_runs.parent_step_key,\n    workflow_runs.continued_from_run_id,\n    workflow_runs.branched_from_run_id,\n    workflow_runs.branched_from_attempt_run_id,\n    workflow_runs.branched_from_attempt_id,\n    workflow_runs.superseded_by_run_id,\n    workflow_runs.definition_name,\n    workflow_runs.definition_version,\n    workflow_runs.task_queue,\n    workflow_runs.priority,\n    workflow_runs.status,\n    workflow_runs.current_step_key,\n    workflow_runs.input,\n    workflow_runs.context,\n    workflow_runs.result,\n    workflow_runs.error,\n    workflow_runs.lease_owner,\n    workflow_runs.lease_expires_at,\n    workflow_runs.cancel_requested_at,\n    workflow_runs.cancel_mode,\n    workflow_runs.available_at,\n    workflow_runs.created_at,\n    workflow_runs.updated_at,\n    workflow_runs.completed_at\n  FROM workflow_runs\n  WHERE id = :runId\n\n  UNION\n\n  SELECT\n    related.id,\n    related.parent_run_id,\n    related.parent_step_key,\n    related.continued_from_run_id,\n    related.branched_from_run_id,\n    related.branched_from_attempt_run_id,\n    related.branched_from_attempt_id,\n    related.superseded_by_run_id,\n    related.definition_name,\n    related.definition_version,\n    related.task_queue,\n    related.priority,\n    related.status,\n    related.current_step_key,\n    related.input,\n    related.context,\n    related.result,\n    related.error,\n    related.lease_owner,\n    related.lease_expires_at,\n    related.cancel_requested_at,\n    related.cancel_mode,\n    related.available_at,\n    related.created_at,\n    related.updated_at,\n    related.completed_at\n  FROM workflow_runs AS related\n  JOIN lineage\n    ON related.id = lineage.continued_from_run_id\n    OR related.id = lineage.branched_from_run_id\n    OR related.id = lineage.superseded_by_run_id\n    OR related.continued_from_run_id = lineage.id\n    OR related.branched_from_run_id = lineage.id\n    OR related.superseded_by_run_id = lineage.id\n)\nSELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM lineage\nORDER BY created_at ASC, updated_at ASC, id ASC"};

/**
 * Query generated from SQL:
 * ```
 * WITH RECURSIVE lineage AS (
 *   SELECT
 *     workflow_runs.id,
 *     workflow_runs.parent_run_id,
 *     workflow_runs.parent_step_key,
 *     workflow_runs.continued_from_run_id,
 *     workflow_runs.branched_from_run_id,
 *     workflow_runs.branched_from_attempt_run_id,
 *     workflow_runs.branched_from_attempt_id,
 *     workflow_runs.superseded_by_run_id,
 *     workflow_runs.definition_name,
 *     workflow_runs.definition_version,
 *     workflow_runs.task_queue,
 *     workflow_runs.priority,
 *     workflow_runs.status,
 *     workflow_runs.current_step_key,
 *     workflow_runs.input,
 *     workflow_runs.context,
 *     workflow_runs.result,
 *     workflow_runs.error,
 *     workflow_runs.lease_owner,
 *     workflow_runs.lease_expires_at,
 *     workflow_runs.cancel_requested_at,
 *     workflow_runs.cancel_mode,
 *     workflow_runs.available_at,
 *     workflow_runs.created_at,
 *     workflow_runs.updated_at,
 *     workflow_runs.completed_at
 *   FROM workflow_runs
 *   WHERE id = :runId
 * 
 *   UNION
 * 
 *   SELECT
 *     related.id,
 *     related.parent_run_id,
 *     related.parent_step_key,
 *     related.continued_from_run_id,
 *     related.branched_from_run_id,
 *     related.branched_from_attempt_run_id,
 *     related.branched_from_attempt_id,
 *     related.superseded_by_run_id,
 *     related.definition_name,
 *     related.definition_version,
 *     related.task_queue,
 *     related.priority,
 *     related.status,
 *     related.current_step_key,
 *     related.input,
 *     related.context,
 *     related.result,
 *     related.error,
 *     related.lease_owner,
 *     related.lease_expires_at,
 *     related.cancel_requested_at,
 *     related.cancel_mode,
 *     related.available_at,
 *     related.created_at,
 *     related.updated_at,
 *     related.completed_at
 *   FROM workflow_runs AS related
 *   JOIN lineage
 *     ON related.id = lineage.continued_from_run_id
 *     OR related.id = lineage.branched_from_run_id
 *     OR related.id = lineage.superseded_by_run_id
 *     OR related.continued_from_run_id = lineage.id
 *     OR related.branched_from_run_id = lineage.id
 *     OR related.superseded_by_run_id = lineage.id
 * )
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM lineage
 * ORDER BY created_at ASC, updated_at ASC, id ASC
 * ```
 */
export const listRunLineage = new PreparedQuery<IListRunLineageParams,IListRunLineageResult>(listRunLineageIR);


/** 'ListActiveRuns' parameters type */
export interface IListActiveRunsParams {
  limit?: NumberOrString | null | void;
}

/** 'ListActiveRuns' return type */
export interface IListActiveRunsResult {
  availableAt: Date;
  completedAt: Date | null;
  context: Json;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ListActiveRuns' query type */
export interface IListActiveRunsQuery {
  params: IListActiveRunsParams;
  result: IListActiveRunsResult;
}

const listActiveRunsIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":537,"b":542}]}],"statement":"SELECT\n  id,\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE status IN ('queued', 'running', 'waiting')\nORDER BY available_at ASC, created_at ASC\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE status IN ('queued', 'running', 'waiting')
 * ORDER BY available_at ASC, created_at ASC
 * LIMIT :limit
 * ```
 */
export const listActiveRuns = new PreparedQuery<IListActiveRunsParams,IListActiveRunsResult>(listActiveRunsIR);


/** 'ListFailedRuns' parameters type */
export interface IListFailedRunsParams {
  limit?: NumberOrString | null | void;
}

/** 'ListFailedRuns' return type */
export interface IListFailedRunsResult {
  availableAt: Date;
  completedAt: Date | null;
  context: Json;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ListFailedRuns' query type */
export interface IListFailedRunsQuery {
  params: IListFailedRunsParams;
  result: IListFailedRunsResult;
}

const listFailedRunsIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":562,"b":567}]}],"statement":"SELECT\n  id,\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE status = 'failed'\n   OR status = 'compensation_failed'\nORDER BY completed_at DESC NULLS LAST, updated_at DESC\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE status = 'failed'
 *    OR status = 'compensation_failed'
 * ORDER BY completed_at DESC NULLS LAST, updated_at DESC
 * LIMIT :limit
 * ```
 */
export const listFailedRuns = new PreparedQuery<IListFailedRunsParams,IListFailedRunsResult>(listFailedRunsIR);


/** 'ListStuckRuns' parameters type */
export interface IListStuckRunsParams {
  limit?: NumberOrString | null | void;
  olderThanMs?: number | null | void;
}

/** 'ListStuckRuns' return type */
export interface IListStuckRunsResult {
  availableAt: Date;
  completedAt: Date | null;
  context: Json;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ListStuckRuns' query type */
export interface IListStuckRunsQuery {
  params: IListStuckRunsParams;
  result: IListStuckRunsResult;
}

const listStuckRunsIR: any = {"usedParamSet":{"olderThanMs":true,"limit":true},"params":[{"name":"olderThanMs","required":false,"transform":{"type":"scalar"},"locs":[{"a":559,"b":570},{"a":666,"b":677}]},{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":759,"b":764}]}],"statement":"SELECT\n  id,\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE\n  (status = 'running' AND lease_expires_at < now())\n  OR (\n    status = 'waiting'\n    AND updated_at <= now() - (:olderThanMs * interval '1 millisecond')\n  )\n  OR (\n    status = 'queued'\n    AND available_at <= now() - (:olderThanMs * interval '1 millisecond')\n  )\nORDER BY updated_at ASC, available_at ASC\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE
 *   (status = 'running' AND lease_expires_at < now())
 *   OR (
 *     status = 'waiting'
 *     AND updated_at <= now() - (:olderThanMs * interval '1 millisecond')
 *   )
 *   OR (
 *     status = 'queued'
 *     AND available_at <= now() - (:olderThanMs * interval '1 millisecond')
 *   )
 * ORDER BY updated_at ASC, available_at ASC
 * LIMIT :limit
 * ```
 */
export const listStuckRuns = new PreparedQuery<IListStuckRunsParams,IListStuckRunsResult>(listStuckRunsIR);


/** 'CancelRun' parameters type */
export interface ICancelRunParams {
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
}

/** 'CancelRun' return type */
export interface ICancelRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CancelRun' query type */
export interface ICancelRunQuery {
  params: ICancelRunParams;
  result: ICancelRunResult;
}

const cancelRunIR: any = {"usedParamSet":{"runId":true,"eventType":true,"eventPayload":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":217,"b":222}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1215,"b":1224}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1227,"b":1239}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'canceled',\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND status IN ('queued', 'running', 'waiting', 'failed')\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, \"currentStepKey\", :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'canceled',
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND status IN ('queued', 'running', 'waiting', 'failed')
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, "currentStepKey", :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const cancelRun = new PreparedQuery<ICancelRunParams,ICancelRunResult>(cancelRunIR);


/** 'RetryRun' parameters type */
export interface IRetryRunParams {
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
}

/** 'RetryRun' return type */
export interface IRetryRunResult {
  availableAt: Date;
  completedAt: Date | null;
  context: Json;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  taskQueue: string;
  updatedAt: Date;
}

/** 'RetryRun' query type */
export interface IRetryRunQuery {
  params: IRetryRunParams;
  result: IRetryRunResult;
}

const retryRunIR: any = {"usedParamSet":{"runId":true,"eventType":true,"eventPayload":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":232,"b":237}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":886,"b":895}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":898,"b":910}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = NULL\n  WHERE id = :runId\n    AND status = 'failed'\n    AND current_step_key IS NOT NULL\n  RETURNING\n    id,\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, \"currentStepKey\", :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = NULL
 *   WHERE id = :runId
 *     AND status = 'failed'
 *     AND current_step_key IS NOT NULL
 *   RETURNING
 *     id,
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, "currentStepKey", :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const retryRun = new PreparedQuery<IRetryRunParams,IRetryRunResult>(retryRunIR);


/** 'RecoverExpiredLeases' parameters type */
export interface IRecoverExpiredLeasesParams {
  limit?: NumberOrString | null | void;
}

/** 'RecoverExpiredLeases' return type */
export interface IRecoverExpiredLeasesResult {
  reclaimedCount: number | null;
}

/** 'RecoverExpiredLeases' query type */
export interface IRecoverExpiredLeasesQuery {
  params: IRecoverExpiredLeasesParams;
  result: IRecoverExpiredLeasesResult;
}

const recoverExpiredLeasesIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":178,"b":183}]}],"statement":"WITH recovered AS (\n  SELECT id\n  FROM workflow_runs\n  WHERE status = 'running'\n    AND lease_expires_at < now()\n  ORDER BY lease_expires_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT :limit\n), updated_runs AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id IN (SELECT id FROM recovered)\n  RETURNING id, current_step_key AS \"currentStepKey\"\n), inserted_events AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, \"currentStepKey\", 'run.recovered', '{}'::jsonb\n  FROM updated_runs\n)\nSELECT COUNT(*)::int AS \"reclaimedCount\"\nFROM updated_runs"};

/**
 * Query generated from SQL:
 * ```
 * WITH recovered AS (
 *   SELECT id
 *   FROM workflow_runs
 *   WHERE status = 'running'
 *     AND lease_expires_at < now()
 *   ORDER BY lease_expires_at ASC
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT :limit
 * ), updated_runs AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id IN (SELECT id FROM recovered)
 *   RETURNING id, current_step_key AS "currentStepKey"
 * ), inserted_events AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, "currentStepKey", 'run.recovered', '{}'::jsonb
 *   FROM updated_runs
 * )
 * SELECT COUNT(*)::int AS "reclaimedCount"
 * FROM updated_runs
 * ```
 */
export const recoverExpiredLeases = new PreparedQuery<IRecoverExpiredLeasesParams,IRecoverExpiredLeasesResult>(recoverExpiredLeasesIR);


/** 'Ping' parameters type */
export type IPingParams = void;

/** 'Ping' return type */
export interface IPingResult {
  ok: number | null;
}

/** 'Ping' query type */
export interface IPingQuery {
  params: IPingParams;
  result: IPingResult;
}

const pingIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT 1::int AS ok"};

/**
 * Query generated from SQL:
 * ```
 * SELECT 1::int AS ok
 * ```
 */
export const ping = new PreparedQuery<IPingParams,IPingResult>(pingIR);


/** 'StartRunIdempotent' parameters type */
export interface IStartRunIdempotentParams {
  currentStepKey?: string | null | void;
  definitionName?: string | null | void;
  definitionVersion?: number | null | void;
  idempotencyKey?: string | null | void;
  input?: Json | null | void;
  parentRunId?: string | null | void;
  parentStepKey?: string | null | void;
  priority?: number | null | void;
  taskQueue?: string | null | void;
  traceContext?: string | null | void;
}

/** 'StartRunIdempotent' return type */
export interface IStartRunIdempotentResult {
  availableAt: Date | null;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json | null;
  continuedFromRunId: string | null;
  createdAt: Date | null;
  currentStepKey: string | null;
  definitionName: string | null;
  definitionVersion: number | null;
  error: Json | null;
  id: string | null;
  input: Json | null;
  inserted: boolean | null;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number | null;
  result: Json | null;
  status: workflow_run_status | null;
  supersededByRunId: string | null;
  taskQueue: string | null;
  traceContext: string | null;
  updatedAt: Date | null;
}

/** 'StartRunIdempotent' query type */
export interface IStartRunIdempotentQuery {
  params: IStartRunIdempotentParams;
  result: IStartRunIdempotentResult;
}

const startRunIdempotentIR: any = {"usedParamSet":{"definitionName":true,"idempotencyKey":true,"parentRunId":true,"parentStepKey":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"input":true,"traceContext":true},"params":[{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":1014,"b":1028},{"a":1390,"b":1404}]},{"name":"idempotencyKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1056,"b":1070},{"a":1522,"b":1536}]},{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1352,"b":1363}]},{"name":"parentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1370,"b":1383}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":1411,"b":1428}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":1435,"b":1444}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":1451,"b":1459}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1501,"b":1515}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":1543,"b":1548}]},{"name":"traceContext","required":false,"transform":{"type":"scalar"},"locs":[{"a":1572,"b":1584}]}],"statement":"WITH existing_run AS (\n  SELECT\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\",\n    trace_context AS \"traceContext\",\n    FALSE AS inserted\n  FROM workflow_runs\n  WHERE definition_name = :definitionName\n    AND idempotency_key = :idempotencyKey\n), inserted_run AS (\n  INSERT INTO workflow_runs (\n    parent_run_id,\n    parent_step_key,\n    definition_name,\n    definition_version,\n    task_queue,\n    priority,\n    status,\n    current_step_key,\n    idempotency_key,\n    input,\n    context,\n    trace_context\n  )\n  SELECT\n    :parentRunId,\n    :parentStepKey,\n    :definitionName,\n    :definitionVersion,\n    :taskQueue,\n    :priority,\n    'queued'::workflow_run_status,\n    :currentStepKey,\n    :idempotencyKey,\n    :input,\n    '{}'::jsonb,\n    :traceContext\n  WHERE NOT EXISTS (SELECT 1 FROM existing_run)\n  ON CONFLICT (definition_name, idempotency_key) DO NOTHING\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\",\n    trace_context AS \"traceContext\",\n    TRUE AS inserted\n)\nSELECT * FROM inserted_run\nUNION ALL\nSELECT * FROM existing_run\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * WITH existing_run AS (
 *   SELECT
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt",
 *     trace_context AS "traceContext",
 *     FALSE AS inserted
 *   FROM workflow_runs
 *   WHERE definition_name = :definitionName
 *     AND idempotency_key = :idempotencyKey
 * ), inserted_run AS (
 *   INSERT INTO workflow_runs (
 *     parent_run_id,
 *     parent_step_key,
 *     definition_name,
 *     definition_version,
 *     task_queue,
 *     priority,
 *     status,
 *     current_step_key,
 *     idempotency_key,
 *     input,
 *     context,
 *     trace_context
 *   )
 *   SELECT
 *     :parentRunId,
 *     :parentStepKey,
 *     :definitionName,
 *     :definitionVersion,
 *     :taskQueue,
 *     :priority,
 *     'queued'::workflow_run_status,
 *     :currentStepKey,
 *     :idempotencyKey,
 *     :input,
 *     '{}'::jsonb,
 *     :traceContext
 *   WHERE NOT EXISTS (SELECT 1 FROM existing_run)
 *   ON CONFLICT (definition_name, idempotency_key) DO NOTHING
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt",
 *     trace_context AS "traceContext",
 *     TRUE AS inserted
 * )
 * SELECT * FROM inserted_run
 * UNION ALL
 * SELECT * FROM existing_run
 * LIMIT 1
 * ```
 */
export const startRunIdempotent = new PreparedQuery<IStartRunIdempotentParams,IStartRunIdempotentResult>(startRunIdempotentIR);


/** 'GetRunByDefinitionAndIdempotencyKey' parameters type */
export interface IGetRunByDefinitionAndIdempotencyKeyParams {
  definitionName?: string | null | void;
  idempotencyKey?: string | null | void;
}

/** 'GetRunByDefinitionAndIdempotencyKey' return type */
export interface IGetRunByDefinitionAndIdempotencyKeyResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'GetRunByDefinitionAndIdempotencyKey' query type */
export interface IGetRunByDefinitionAndIdempotencyKeyQuery {
  params: IGetRunByDefinitionAndIdempotencyKeyParams;
  result: IGetRunByDefinitionAndIdempotencyKeyResult;
}

const getRunByDefinitionAndIdempotencyKeyIR: any = {"usedParamSet":{"definitionName":true,"idempotencyKey":true},"params":[{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":873,"b":887}]},{"name":"idempotencyKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":913,"b":927}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE definition_name = :definitionName\n  AND idempotency_key = :idempotencyKey\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE definition_name = :definitionName
 *   AND idempotency_key = :idempotencyKey
 * LIMIT 1
 * ```
 */
export const getRunByDefinitionAndIdempotencyKey = new PreparedQuery<IGetRunByDefinitionAndIdempotencyKeyParams,IGetRunByDefinitionAndIdempotencyKeyResult>(getRunByDefinitionAndIdempotencyKeyIR);


/** 'ContinueAsNewCompleteSource' parameters type */
export interface IContinueAsNewCompleteSourceParams {
  context?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'ContinueAsNewCompleteSource' return type */
export interface IContinueAsNewCompleteSourceResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ContinueAsNewCompleteSource' query type */
export interface IContinueAsNewCompleteSourceQuery {
  params: IContinueAsNewCompleteSourceParams;
  result: IContinueAsNewCompleteSourceResult;
}

const continueAsNewCompleteSourceIR: any = {"usedParamSet":{"context":true,"runId":true,"stepKey":true,"workerId":true},"params":[{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":88,"b":95}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":260,"b":265}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":292,"b":299}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":321,"b":329}]}],"statement":"UPDATE workflow_runs\nSET\n  status = 'completed',\n  current_step_key = NULL,\n  context = :context,\n  result = NULL,\n  error = NULL,\n  lease_owner = NULL,\n  lease_expires_at = NULL,\n  available_at = now(),\n  updated_at = now(),\n  completed_at = now()\nWHERE id = :runId\n  AND current_step_key = :stepKey\n  AND lease_owner = :workerId\n  AND lease_expires_at >= now()\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\""};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_runs
 * SET
 *   status = 'completed',
 *   current_step_key = NULL,
 *   context = :context,
 *   result = NULL,
 *   error = NULL,
 *   lease_owner = NULL,
 *   lease_expires_at = NULL,
 *   available_at = now(),
 *   updated_at = now(),
 *   completed_at = now()
 * WHERE id = :runId
 *   AND current_step_key = :stepKey
 *   AND lease_owner = :workerId
 *   AND lease_expires_at >= now()
 * RETURNING
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * ```
 */
export const continueAsNewCompleteSource = new PreparedQuery<IContinueAsNewCompleteSourceParams,IContinueAsNewCompleteSourceResult>(continueAsNewCompleteSourceIR);


/** 'ContinueAsNewInsertRun' parameters type */
export interface IContinueAsNewInsertRunParams {
  continuedFromRunId?: string | null | void;
  currentStepKey?: string | null | void;
  definitionName?: string | null | void;
  definitionVersion?: number | null | void;
  input?: Json | null | void;
  priority?: number | null | void;
  taskQueue?: string | null | void;
  traceContext?: string | null | void;
}

/** 'ContinueAsNewInsertRun' return type */
export interface IContinueAsNewInsertRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  traceContext: string | null;
  updatedAt: Date;
}

/** 'ContinueAsNewInsertRun' query type */
export interface IContinueAsNewInsertRunQuery {
  params: IContinueAsNewInsertRunParams;
  result: IContinueAsNewInsertRunResult;
}

const continueAsNewInsertRunIR: any = {"usedParamSet":{"continuedFromRunId":true,"definitionName":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"input":true,"traceContext":true},"params":[{"name":"continuedFromRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":199,"b":217}]},{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":222,"b":236}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":241,"b":258}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":263,"b":272}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":277,"b":285}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":302,"b":316}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":321,"b":326}]},{"name":"traceContext","required":false,"transform":{"type":"scalar"},"locs":[{"a":346,"b":358}]}],"statement":"INSERT INTO workflow_runs (\n  continued_from_run_id,\n  definition_name,\n  definition_version,\n  task_queue,\n  priority,\n  status,\n  current_step_key,\n  input,\n  context,\n  trace_context\n) VALUES (\n  :continuedFromRunId,\n  :definitionName,\n  :definitionVersion,\n  :taskQueue,\n  :priority,\n  'queued',\n  :currentStepKey,\n  :input,\n  '{}'::jsonb,\n  :traceContext\n)\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\",\n  trace_context AS \"traceContext\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_runs (
 *   continued_from_run_id,
 *   definition_name,
 *   definition_version,
 *   task_queue,
 *   priority,
 *   status,
 *   current_step_key,
 *   input,
 *   context,
 *   trace_context
 * ) VALUES (
 *   :continuedFromRunId,
 *   :definitionName,
 *   :definitionVersion,
 *   :taskQueue,
 *   :priority,
 *   'queued',
 *   :currentStepKey,
 *   :input,
 *   '{}'::jsonb,
 *   :traceContext
 * )
 * RETURNING
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt",
 *   trace_context AS "traceContext"
 * ```
 */
export const continueAsNewInsertRun = new PreparedQuery<IContinueAsNewInsertRunParams,IContinueAsNewInsertRunResult>(continueAsNewInsertRunIR);


/** 'ContinueAsNewSetResult' parameters type */
export interface IContinueAsNewSetResultParams {
  continuedRunId?: string | null | void;
  runId?: string | null | void;
}

/** 'ContinueAsNewSetResult' return type */
export type IContinueAsNewSetResultResult = void;

/** 'ContinueAsNewSetResult' query type */
export interface IContinueAsNewSetResultQuery {
  params: IContinueAsNewSetResultParams;
  result: IContinueAsNewSetResultResult;
}

const continueAsNewSetResultIR: any = {"usedParamSet":{"continuedRunId":true,"runId":true},"params":[{"name":"continuedRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":73,"b":87}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":129,"b":134}]}],"statement":"UPDATE workflow_runs\nSET\n  result = jsonb_build_object('continuedRunId', :continuedRunId::text),\n  updated_at = now()\nWHERE id = :runId"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_runs
 * SET
 *   result = jsonb_build_object('continuedRunId', :continuedRunId::text),
 *   updated_at = now()
 * WHERE id = :runId
 * ```
 */
export const continueAsNewSetResult = new PreparedQuery<IContinueAsNewSetResultParams,IContinueAsNewSetResultResult>(continueAsNewSetResultIR);


/** 'ContinueAsNewCompleteAttempt' parameters type */
export interface IContinueAsNewCompleteAttemptParams {
  attemptId?: string | null | void;
  continuedRunId?: string | null | void;
  runId?: string | null | void;
}

/** 'ContinueAsNewCompleteAttempt' return type */
export type IContinueAsNewCompleteAttemptResult = void;

/** 'ContinueAsNewCompleteAttempt' query type */
export interface IContinueAsNewCompleteAttemptQuery {
  params: IContinueAsNewCompleteAttemptParams;
  result: IContinueAsNewCompleteAttemptResult;
}

const continueAsNewCompleteAttemptIR: any = {"usedParamSet":{"continuedRunId":true,"attemptId":true,"runId":true},"params":[{"name":"continuedRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":106,"b":120}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":202,"b":211}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":228,"b":233}]}],"statement":"UPDATE workflow_step_attempts\nSET\n  status = 'completed',\n  output = jsonb_build_object('continuedRunId', :continuedRunId::text),\n  error = NULL,\n  completed_at = now(),\n  updated_at = now()\nWHERE id = :attemptId\n  AND run_id = :runId"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_step_attempts
 * SET
 *   status = 'completed',
 *   output = jsonb_build_object('continuedRunId', :continuedRunId::text),
 *   error = NULL,
 *   completed_at = now(),
 *   updated_at = now()
 * WHERE id = :attemptId
 *   AND run_id = :runId
 * ```
 */
export const continueAsNewCompleteAttempt = new PreparedQuery<IContinueAsNewCompleteAttemptParams,IContinueAsNewCompleteAttemptResult>(continueAsNewCompleteAttemptIR);


/** 'GetChildRun' parameters type */
export interface IGetChildRunParams {
  parentRunId?: string | null | void;
  parentStepKey?: string | null | void;
}

/** 'GetChildRun' return type */
export interface IGetChildRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'GetChildRun' query type */
export interface IGetChildRunQuery {
  params: IGetChildRunParams;
  result: IGetChildRunResult;
}

const getChildRunIR: any = {"usedParamSet":{"parentRunId":true,"parentStepKey":true},"params":[{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":871,"b":882}]},{"name":"parentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":908,"b":921}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE parent_run_id = :parentRunId\n  AND parent_step_key = :parentStepKey\nORDER BY created_at ASC\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE parent_run_id = :parentRunId
 *   AND parent_step_key = :parentStepKey
 * ORDER BY created_at ASC
 * LIMIT 1
 * ```
 */
export const getChildRun = new PreparedQuery<IGetChildRunParams,IGetChildRunResult>(getChildRunIR);


/** 'ListChildRuns' parameters type */
export interface IListChildRunsParams {
  parentRunId?: string | null | void;
}

/** 'ListChildRuns' return type */
export interface IListChildRunsResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'ListChildRuns' query type */
export interface IListChildRunsQuery {
  params: IListChildRunsParams;
  result: IListChildRunsResult;
}

const listChildRunsIR: any = {"usedParamSet":{"parentRunId":true},"params":[{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":871,"b":882}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE parent_run_id = :parentRunId\nORDER BY created_at ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   parent_run_id AS "parentRunId",
 *   parent_step_key AS "parentStepKey",
 *   continued_from_run_id AS "continuedFromRunId",
 *   branched_from_run_id AS "branchedFromRunId",
 *   branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *   branched_from_attempt_id AS "branchedFromAttemptId",
 *   superseded_by_run_id AS "supersededByRunId",
 *   definition_name AS "definitionName",
 *   definition_version AS "definitionVersion",
 *   task_queue AS "taskQueue",
 *   priority,
 *   status,
 *   current_step_key AS "currentStepKey",
 *   input,
 *   context,
 *   result,
 *   error,
 *   lease_owner AS "leaseOwner",
 *   lease_expires_at AS "leaseExpiresAt",
 *   cancel_requested_at AS "cancelRequestedAt",
 *   cancel_mode AS "cancelMode",
 *   available_at AS "availableAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   completed_at AS "completedAt"
 * FROM workflow_runs
 * WHERE parent_run_id = :parentRunId
 * ORDER BY created_at ASC
 * ```
 */
export const listChildRuns = new PreparedQuery<IListChildRunsParams,IListChildRunsResult>(listChildRunsIR);


/** 'WakeParentForChild' parameters type */
export interface IWakeParentForChildParams {
  correlationKey?: string | null | void;
  payload?: Json | null | void;
}

/** 'WakeParentForChild' return type */
export interface IWakeParentForChildResult {
  runId: string;
}

/** 'WakeParentForChild' query type */
export interface IWakeParentForChildQuery {
  params: IWakeParentForChildParams;
  result: IWakeParentForChildResult;
}

const wakeParentForChildIR: any = {"usedParamSet":{"payload":true,"correlationKey":true},"params":[{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":105},{"a":680,"b":687}]},{"name":"correlationKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":181,"b":195}]}],"statement":"WITH updated_wait AS (\n  UPDATE workflow_waits\n  SET\n    status = 'resumed',\n    resume_payload = :payload,\n    resumed_at = now(),\n    updated_at = now()\n  WHERE correlation_key = :correlationKey\n    AND status = 'open'\n  RETURNING run_id AS \"runId\", step_key AS \"stepKey\"\n), updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id IN (SELECT \"runId\" FROM updated_wait)\n    AND status = 'waiting'\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT \"runId\", \"stepKey\", 'child.completed', :payload\n  FROM updated_wait\n  WHERE EXISTS (SELECT 1 FROM updated_run)\n)\nSELECT id AS \"runId\"\nFROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_wait AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = 'resumed',
 *     resume_payload = :payload,
 *     resumed_at = now(),
 *     updated_at = now()
 *   WHERE correlation_key = :correlationKey
 *     AND status = 'open'
 *   RETURNING run_id AS "runId", step_key AS "stepKey"
 * ), updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id IN (SELECT "runId" FROM updated_wait)
 *     AND status = 'waiting'
 *   RETURNING id
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT "runId", "stepKey", 'child.completed', :payload
 *   FROM updated_wait
 *   WHERE EXISTS (SELECT 1 FROM updated_run)
 * )
 * SELECT id AS "runId"
 * FROM updated_run
 * ```
 */
export const wakeParentForChild = new PreparedQuery<IWakeParentForChildParams,IWakeParentForChildResult>(wakeParentForChildIR);


/** 'GetFanOutWaitByChildRunId' parameters type */
export interface IGetFanOutWaitByChildRunIdParams {
  childRunId?: string | null | void;
}

/** 'GetFanOutWaitByChildRunId' return type */
export interface IGetFanOutWaitByChildRunIdResult {
  correlationKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  payload: Json | null;
  resumedAt: Date | null;
  resumeOutput: Json | null;
  resumePayload: Json | null;
  runId: string;
  status: workflow_wait_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'GetFanOutWaitByChildRunId' query type */
export interface IGetFanOutWaitByChildRunIdQuery {
  params: IGetFanOutWaitByChildRunIdParams;
  result: IGetFanOutWaitByChildRunIdResult;
}

const getFanOutWaitByChildRunIdIR: any = {"usedParamSet":{"childRunId":true},"params":[{"name":"childRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":514,"b":524}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\"\nFROM workflow_waits\nWHERE status = 'open'\n  AND payload->>'kind' = 'fanOutChild'\n  AND payload->>'childRunId' = :childRunId\nLIMIT 1"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   status,
 *   payload,
 *   resume_payload AS "resumePayload",
 *   resume_output AS "resumeOutput",
 *   expires_at AS "expiresAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   resumed_at AS "resumedAt",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * FROM workflow_waits
 * WHERE status = 'open'
 *   AND payload->>'kind' = 'fanOutChild'
 *   AND payload->>'childRunId' = :childRunId
 * LIMIT 1
 * ```
 */
export const getFanOutWaitByChildRunId = new PreparedQuery<IGetFanOutWaitByChildRunIdParams,IGetFanOutWaitByChildRunIdResult>(getFanOutWaitByChildRunIdIR);


/** 'UpdateWaitStatus' parameters type */
export interface IUpdateWaitStatusParams {
  resumePayload?: Json | null | void;
  status?: workflow_wait_status | null | void;
  waitId?: string | null | void;
}

/** 'UpdateWaitStatus' return type */
export interface IUpdateWaitStatusResult {
  correlationKey: string;
  createdAt: Date;
  expiresAt: Date | null;
  externalSessionId: string | null;
  externalSessionKind: string | null;
  id: string;
  payload: Json | null;
  resumedAt: Date | null;
  resumeOutput: Json | null;
  resumePayload: Json | null;
  runId: string;
  status: workflow_wait_status;
  stepKey: string;
  updatedAt: Date;
}

/** 'UpdateWaitStatus' query type */
export interface IUpdateWaitStatusQuery {
  params: IUpdateWaitStatusParams;
  result: IUpdateWaitStatusResult;
}

const updateWaitStatusIR: any = {"usedParamSet":{"status":true,"resumePayload":true,"waitId":true},"params":[{"name":"status","required":false,"transform":{"type":"scalar"},"locs":[{"a":37,"b":43},{"a":154,"b":160}]},{"name":"resumePayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":87,"b":100}]},{"name":"waitId","required":false,"transform":{"type":"scalar"},"locs":[{"a":266,"b":272}]}],"statement":"UPDATE workflow_waits\nSET\n  status = :status::workflow_wait_status,\n  resume_payload = :resumePayload,\n  updated_at = now(),\n  resumed_at = CASE\n    WHEN :status::workflow_wait_status = 'resumed'::workflow_wait_status THEN now()\n    ELSE resumed_at\n  END\nWHERE id = :waitId\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\",\n  external_session_id AS \"externalSessionId\",\n  external_session_kind AS \"externalSessionKind\""};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_waits
 * SET
 *   status = :status::workflow_wait_status,
 *   resume_payload = :resumePayload,
 *   updated_at = now(),
 *   resumed_at = CASE
 *     WHEN :status::workflow_wait_status = 'resumed'::workflow_wait_status THEN now()
 *     ELSE resumed_at
 *   END
 * WHERE id = :waitId
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   step_key AS "stepKey",
 *   correlation_key AS "correlationKey",
 *   status,
 *   payload,
 *   resume_payload AS "resumePayload",
 *   resume_output AS "resumeOutput",
 *   expires_at AS "expiresAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt",
 *   resumed_at AS "resumedAt",
 *   external_session_id AS "externalSessionId",
 *   external_session_kind AS "externalSessionKind"
 * ```
 */
export const updateWaitStatus = new PreparedQuery<IUpdateWaitStatusParams,IUpdateWaitStatusResult>(updateWaitStatusIR);


/** 'QueueWaitingRun' parameters type */
export interface IQueueWaitingRunParams {
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
}

/** 'QueueWaitingRun' return type */
export interface IQueueWaitingRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'QueueWaitingRun' query type */
export interface IQueueWaitingRunQuery {
  params: IQueueWaitingRunParams;
  result: IQueueWaitingRunResult;
}

const queueWaitingRunIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"eventType":true,"eventPayload":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":189,"b":194}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":223,"b":230},{"a":1252,"b":1259}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1262,"b":1271}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1274,"b":1286}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND status = 'waiting'\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND status = 'waiting'
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const queueWaitingRun = new PreparedQuery<IQueueWaitingRunParams,IQueueWaitingRunResult>(queueWaitingRunIR);


/** 'RequestCancelRun' parameters type */
export interface IRequestCancelRunParams {
  eventPayload?: Json | null | void;
  eventType?: string | null | void;
  mode?: string | null | void;
  runId?: string | null | void;
}

/** 'RequestCancelRun' return type */
export interface IRequestCancelRunResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'RequestCancelRun' query type */
export interface IRequestCancelRunQuery {
  params: IRequestCancelRunParams;
  result: IRequestCancelRunResult;
}

const requestCancelRunIR: any = {"usedParamSet":{"mode":true,"runId":true,"eventType":true,"eventPayload":true},"params":[{"name":"mode","required":false,"transform":{"type":"scalar"},"locs":[{"a":102,"b":106},{"a":138,"b":142},{"a":376,"b":380},{"a":456,"b":460},{"a":593,"b":597},{"a":1716,"b":1720}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":685,"b":690}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":2004,"b":2013}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":2016,"b":2028}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    cancel_requested_at = now(),\n    cancel_mode = :mode,\n    status = CASE\n      WHEN :mode = 'hard' THEN 'canceled'::workflow_run_status\n      WHEN status = 'waiting' THEN 'queued'::workflow_run_status\n      WHEN status = 'failed' THEN 'canceled'::workflow_run_status\n      ELSE status\n    END,\n    lease_owner = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_owner END,\n    lease_expires_at = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_expires_at END,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = CASE\n      WHEN :mode = 'hard' OR status = 'failed' THEN now()\n      ELSE completed_at\n    END\n  WHERE id = :runId\n    AND status IN ('queued', 'running', 'waiting', 'failed')\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), canceled_waits AS (\n  UPDATE workflow_waits\n  SET\n    status = CASE WHEN :mode = 'hard' THEN 'canceled'::workflow_wait_status ELSE status END,\n    updated_at = now()\n  WHERE run_id IN (SELECT id FROM updated_run)\n    AND status = 'open'\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, \"currentStepKey\", :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     cancel_requested_at = now(),
 *     cancel_mode = :mode,
 *     status = CASE
 *       WHEN :mode = 'hard' THEN 'canceled'::workflow_run_status
 *       WHEN status = 'waiting' THEN 'queued'::workflow_run_status
 *       WHEN status = 'failed' THEN 'canceled'::workflow_run_status
 *       ELSE status
 *     END,
 *     lease_owner = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_owner END,
 *     lease_expires_at = CASE WHEN :mode = 'hard' THEN NULL ELSE lease_expires_at END,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = CASE
 *       WHEN :mode = 'hard' OR status = 'failed' THEN now()
 *       ELSE completed_at
 *     END
 *   WHERE id = :runId
 *     AND status IN ('queued', 'running', 'waiting', 'failed')
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), canceled_waits AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = CASE WHEN :mode = 'hard' THEN 'canceled'::workflow_wait_status ELSE status END,
 *     updated_at = now()
 *   WHERE run_id IN (SELECT id FROM updated_run)
 *     AND status = 'open'
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, "currentStepKey", :eventType, :eventPayload
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const requestCancelRun = new PreparedQuery<IRequestCancelRunParams,IRequestCancelRunResult>(requestCancelRunIR);


/** 'CancelRunAtBoundary' parameters type */
export interface ICancelRunAtBoundaryParams {
  mode?: string | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'CancelRunAtBoundary' return type */
export interface ICancelRunAtBoundaryResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CancelRunAtBoundary' query type */
export interface ICancelRunAtBoundaryQuery {
  params: ICancelRunAtBoundaryParams;
  result: ICancelRunAtBoundaryResult;
}

const cancelRunAtBoundaryIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"workerId":true,"mode":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":217,"b":222}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":251,"b":258},{"a":1531,"b":1538}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":282,"b":290}]},{"name":"mode","required":false,"transform":{"type":"scalar"},"locs":[{"a":1584,"b":1588}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'canceled',\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n    AND cancel_requested_at IS NOT NULL\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), canceled_waits AS (\n  UPDATE workflow_waits\n  SET\n    status = 'canceled',\n    updated_at = now()\n  WHERE run_id IN (SELECT id FROM updated_run)\n    AND status = 'open'\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'run.canceled', jsonb_build_object('mode', :mode::text)\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'canceled',
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *     AND cancel_requested_at IS NOT NULL
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), canceled_waits AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = 'canceled',
 *     updated_at = now()
 *   WHERE run_id IN (SELECT id FROM updated_run)
 *     AND status = 'open'
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'run.canceled', jsonb_build_object('mode', :mode::text)
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const cancelRunAtBoundary = new PreparedQuery<ICancelRunAtBoundaryParams,ICancelRunAtBoundaryResult>(cancelRunAtBoundaryIR);


/** 'InsertOutbox' parameters type */
export interface IInsertOutboxParams {
  availableAt?: DateOrString | null | void;
  payload?: Json | null | void;
  runId?: string | null | void;
  topic?: string | null | void;
}

/** 'InsertOutbox' return type */
export interface IInsertOutboxResult {
  availableAt: Date;
  createdAt: Date;
  deliveredAt: Date | null;
  id: string;
  payload: Json;
  runId: string | null;
  topic: string;
  updatedAt: Date;
}

/** 'InsertOutbox' query type */
export interface IInsertOutboxQuery {
  params: IInsertOutboxParams;
  result: IInsertOutboxResult;
}

const insertOutboxIR: any = {"usedParamSet":{"runId":true,"topic":true,"payload":true,"availableAt":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":88,"b":93}]},{"name":"topic","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":103}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":108,"b":115}]},{"name":"availableAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":129,"b":140}]}],"statement":"INSERT INTO workflow_outbox (\n  run_id,\n  topic,\n  payload,\n  available_at\n) VALUES (\n  :runId,\n  :topic,\n  :payload,\n  COALESCE(:availableAt, now())\n)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  topic,\n  payload,\n  available_at AS \"availableAt\",\n  delivered_at AS \"deliveredAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_outbox (
 *   run_id,
 *   topic,
 *   payload,
 *   available_at
 * ) VALUES (
 *   :runId,
 *   :topic,
 *   :payload,
 *   COALESCE(:availableAt, now())
 * )
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   topic,
 *   payload,
 *   available_at AS "availableAt",
 *   delivered_at AS "deliveredAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const insertOutbox = new PreparedQuery<IInsertOutboxParams,IInsertOutboxResult>(insertOutboxIR);


/** 'ClaimOutboxMessages' parameters type */
export interface IClaimOutboxMessagesParams {
  limit?: NumberOrString | null | void;
}

/** 'ClaimOutboxMessages' return type */
export interface IClaimOutboxMessagesResult {
  availableAt: Date;
  createdAt: Date;
  deliveredAt: Date | null;
  id: string;
  payload: Json;
  runId: string | null;
  topic: string;
  updatedAt: Date;
}

/** 'ClaimOutboxMessages' query type */
export interface IClaimOutboxMessagesQuery {
  params: IClaimOutboxMessagesParams;
  result: IClaimOutboxMessagesResult;
}

const claimOutboxMessagesIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":191,"b":196}]}],"statement":"WITH candidate AS (\n  SELECT id\n  FROM workflow_outbox\n  WHERE delivered_at IS NULL\n    AND available_at <= now()\n  ORDER BY available_at ASC, created_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT :limit\n)\nUPDATE workflow_outbox\nSET\n  available_at = now() + interval '30 seconds',\n  updated_at = now()\nWHERE id IN (SELECT id FROM candidate)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  topic,\n  payload,\n  available_at AS \"availableAt\",\n  delivered_at AS \"deliveredAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * WITH candidate AS (
 *   SELECT id
 *   FROM workflow_outbox
 *   WHERE delivered_at IS NULL
 *     AND available_at <= now()
 *   ORDER BY available_at ASC, created_at ASC
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT :limit
 * )
 * UPDATE workflow_outbox
 * SET
 *   available_at = now() + interval '30 seconds',
 *   updated_at = now()
 * WHERE id IN (SELECT id FROM candidate)
 * RETURNING
 *   id,
 *   run_id AS "runId",
 *   topic,
 *   payload,
 *   available_at AS "availableAt",
 *   delivered_at AS "deliveredAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const claimOutboxMessages = new PreparedQuery<IClaimOutboxMessagesParams,IClaimOutboxMessagesResult>(claimOutboxMessagesIR);


/** 'MarkOutboxDelivered' parameters type */
export interface IMarkOutboxDeliveredParams {
  outboxId?: string | null | void;
}

/** 'MarkOutboxDelivered' return type */
export interface IMarkOutboxDeliveredResult {
  delivered: number | null;
}

/** 'MarkOutboxDelivered' query type */
export interface IMarkOutboxDeliveredQuery {
  params: IMarkOutboxDeliveredParams;
  result: IMarkOutboxDeliveredResult;
}

const markOutboxDeliveredIR: any = {"usedParamSet":{"outboxId":true},"params":[{"name":"outboxId","required":false,"transform":{"type":"scalar"},"locs":[{"a":83,"b":91}]}],"statement":"UPDATE workflow_outbox\nSET\n  delivered_at = now(),\n  updated_at = now()\nWHERE id = :outboxId\n  AND delivered_at IS NULL\nRETURNING 1::int AS delivered"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_outbox
 * SET
 *   delivered_at = now(),
 *   updated_at = now()
 * WHERE id = :outboxId
 *   AND delivered_at IS NULL
 * RETURNING 1::int AS delivered
 * ```
 */
export const markOutboxDelivered = new PreparedQuery<IMarkOutboxDeliveredParams,IMarkOutboxDeliveredResult>(markOutboxDeliveredIR);


/** 'CreateSchedule' parameters type */
export interface ICreateScheduleParams {
  cronExpression?: string | null | void;
  nextFireAt?: DateOrString | null | void;
  payload?: Json | null | void;
  priority?: number | null | void;
  taskQueue?: string | null | void;
  workflowName?: string | null | void;
}

/** 'CreateSchedule' return type */
export interface ICreateScheduleResult {
  active: boolean;
  createdAt: Date;
  cronExpression: string;
  id: string;
  nextFireAt: Date;
  payload: Json;
  priority: number;
  taskQueue: string;
  updatedAt: Date;
  workflowName: string;
}

/** 'CreateSchedule' query type */
export interface ICreateScheduleQuery {
  params: ICreateScheduleParams;
  result: ICreateScheduleResult;
}

const createScheduleIR: any = {"usedParamSet":{"workflowName":true,"cronExpression":true,"payload":true,"taskQueue":true,"priority":true,"nextFireAt":true},"params":[{"name":"workflowName","required":false,"transform":{"type":"scalar"},"locs":[{"a":134,"b":146}]},{"name":"cronExpression","required":false,"transform":{"type":"scalar"},"locs":[{"a":151,"b":165}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":170,"b":177}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":182,"b":191}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":196,"b":204}]},{"name":"nextFireAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":209,"b":219}]}],"statement":"INSERT INTO workflow_schedules (\n  workflow_name,\n  cron_expression,\n  payload,\n  task_queue,\n  priority,\n  next_fire_at\n) VALUES (\n  :workflowName,\n  :cronExpression,\n  :payload,\n  :taskQueue,\n  :priority,\n  :nextFireAt\n)\nRETURNING\n  id,\n  workflow_name AS \"workflowName\",\n  cron_expression AS \"cronExpression\",\n  payload,\n  task_queue AS \"taskQueue\",\n  priority,\n  active,\n  next_fire_at AS \"nextFireAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_schedules (
 *   workflow_name,
 *   cron_expression,
 *   payload,
 *   task_queue,
 *   priority,
 *   next_fire_at
 * ) VALUES (
 *   :workflowName,
 *   :cronExpression,
 *   :payload,
 *   :taskQueue,
 *   :priority,
 *   :nextFireAt
 * )
 * RETURNING
 *   id,
 *   workflow_name AS "workflowName",
 *   cron_expression AS "cronExpression",
 *   payload,
 *   task_queue AS "taskQueue",
 *   priority,
 *   active,
 *   next_fire_at AS "nextFireAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * ```
 */
export const createSchedule = new PreparedQuery<ICreateScheduleParams,ICreateScheduleResult>(createScheduleIR);


/** 'ListSchedules' parameters type */
export type IListSchedulesParams = void;

/** 'ListSchedules' return type */
export interface IListSchedulesResult {
  active: boolean;
  createdAt: Date;
  cronExpression: string;
  id: string;
  nextFireAt: Date;
  payload: Json;
  priority: number;
  taskQueue: string;
  updatedAt: Date;
  workflowName: string;
}

/** 'ListSchedules' query type */
export interface IListSchedulesQuery {
  params: IListSchedulesParams;
  result: IListSchedulesResult;
}

const listSchedulesIR: any = {"usedParamSet":{},"params":[],"statement":"SELECT\n  id,\n  workflow_name AS \"workflowName\",\n  cron_expression AS \"cronExpression\",\n  payload,\n  task_queue AS \"taskQueue\",\n  priority,\n  active,\n  next_fire_at AS \"nextFireAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\"\nFROM workflow_schedules\nORDER BY next_fire_at ASC, created_at ASC"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   workflow_name AS "workflowName",
 *   cron_expression AS "cronExpression",
 *   payload,
 *   task_queue AS "taskQueue",
 *   priority,
 *   active,
 *   next_fire_at AS "nextFireAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * FROM workflow_schedules
 * ORDER BY next_fire_at ASC, created_at ASC
 * ```
 */
export const listSchedules = new PreparedQuery<IListSchedulesParams,IListSchedulesResult>(listSchedulesIR);


/** 'ClaimDueSchedules' parameters type */
export interface IClaimDueSchedulesParams {
  limit?: NumberOrString | null | void;
}

/** 'ClaimDueSchedules' return type */
export interface IClaimDueSchedulesResult {
  active: boolean;
  createdAt: Date;
  cronExpression: string;
  id: string;
  nextFireAt: Date;
  payload: Json;
  priority: number;
  taskQueue: string;
  updatedAt: Date;
  workflowName: string;
}

/** 'ClaimDueSchedules' query type */
export interface IClaimDueSchedulesQuery {
  params: IClaimDueSchedulesParams;
  result: IClaimDueSchedulesResult;
}

const claimDueSchedulesIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":381,"b":386}]}],"statement":"SELECT\n  id,\n  workflow_name AS \"workflowName\",\n  cron_expression AS \"cronExpression\",\n  payload,\n  task_queue AS \"taskQueue\",\n  priority,\n  active,\n  next_fire_at AS \"nextFireAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\"\nFROM workflow_schedules\nWHERE active = TRUE\n  AND next_fire_at <= now()\nORDER BY next_fire_at ASC, created_at ASC\nFOR UPDATE SKIP LOCKED\nLIMIT :limit"};

/**
 * Query generated from SQL:
 * ```
 * SELECT
 *   id,
 *   workflow_name AS "workflowName",
 *   cron_expression AS "cronExpression",
 *   payload,
 *   task_queue AS "taskQueue",
 *   priority,
 *   active,
 *   next_fire_at AS "nextFireAt",
 *   created_at AS "createdAt",
 *   updated_at AS "updatedAt"
 * FROM workflow_schedules
 * WHERE active = TRUE
 *   AND next_fire_at <= now()
 * ORDER BY next_fire_at ASC, created_at ASC
 * FOR UPDATE SKIP LOCKED
 * LIMIT :limit
 * ```
 */
export const claimDueSchedules = new PreparedQuery<IClaimDueSchedulesParams,IClaimDueSchedulesResult>(claimDueSchedulesIR);


/** 'RescheduleAfterFire' parameters type */
export interface IRescheduleAfterFireParams {
  id?: string | null | void;
  nextFireAt?: DateOrString | null | void;
}

/** 'RescheduleAfterFire' return type */
export type IRescheduleAfterFireResult = void;

/** 'RescheduleAfterFire' query type */
export interface IRescheduleAfterFireQuery {
  params: IRescheduleAfterFireParams;
  result: IRescheduleAfterFireResult;
}

const rescheduleAfterFireIR: any = {"usedParamSet":{"nextFireAt":true,"id":true},"params":[{"name":"nextFireAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":47,"b":57}]},{"name":"id","required":false,"transform":{"type":"scalar"},"locs":[{"a":92,"b":94}]}],"statement":"UPDATE workflow_schedules\nSET\n  next_fire_at = :nextFireAt,\n  updated_at = now()\nWHERE id = :id"};

/**
 * Query generated from SQL:
 * ```
 * UPDATE workflow_schedules
 * SET
 *   next_fire_at = :nextFireAt,
 *   updated_at = now()
 * WHERE id = :id
 * ```
 */
export const rescheduleAfterFire = new PreparedQuery<IRescheduleAfterFireParams,IRescheduleAfterFireResult>(rescheduleAfterFireIR);


/** 'CompleteTransactionalTask' parameters type */
export interface ICompleteTransactionalTaskParams {
  attemptId?: string | null | void;
  context?: Json | null | void;
  nextStepKey?: string | null | void;
  output?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'CompleteTransactionalTask' return type */
export interface ICompleteTransactionalTaskResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'CompleteTransactionalTask' query type */
export interface ICompleteTransactionalTaskQuery {
  params: ICompleteTransactionalTaskParams;
  result: ICompleteTransactionalTaskResult;
}

const completeTransactionalTaskIR: any = {"usedParamSet":{"nextStepKey":true,"context":true,"runId":true,"stepKey":true,"workerId":true,"output":true,"attemptId":true},"params":[{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":108},{"a":1699,"b":1710}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":125,"b":132}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":287,"b":292}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":321,"b":328},{"a":1637,"b":1644}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":352,"b":360}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":1384,"b":1390}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1473,"b":1482}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    context = :context,\n    result = NULL,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'completed',\n    output = :output,\n    error = NULL,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'step.completed', jsonb_build_object('nextStepKey', :nextStepKey)\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :nextStepKey,
 *     context = :context,
 *     result = NULL,
 *     error = NULL,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'completed',
 *     output = :output,
 *     error = NULL,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'step.completed', jsonb_build_object('nextStepKey', :nextStepKey)
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const completeTransactionalTask = new PreparedQuery<ICompleteTransactionalTaskParams,ICompleteTransactionalTaskResult>(completeTransactionalTaskIR);


/** 'RetryTransactionalTask' parameters type */
export interface IRetryTransactionalTaskParams {
  attemptId?: string | null | void;
  availableAt?: DateOrString | null | void;
  error?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'RetryTransactionalTask' return type */
export interface IRetryTransactionalTaskResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'RetryTransactionalTask' query type */
export interface IRetryTransactionalTaskQuery {
  params: IRetryTransactionalTaskParams;
  result: IRetryTransactionalTaskResult;
}

const retryTransactionalTaskIR: any = {"usedParamSet":{"stepKey":true,"error":true,"availableAt":true,"runId":true,"workerId":true,"attemptId":true},"params":[{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":97,"b":104},{"a":308,"b":315},{"a":1620,"b":1627}]},{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":119,"b":124},{"a":1386,"b":1391}]},{"name":"availableAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":199,"b":210},{"a":1701,"b":1712}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":274,"b":279}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":339,"b":347}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1456,"b":1465}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :stepKey,\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = :availableAt,\n    updated_at = now(),\n    completed_at = NULL\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'failed',\n    output = NULL,\n    error = :error,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'step.retry_scheduled',\n    jsonb_build_object('availableAt', to_jsonb(:availableAt))\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'queued',
 *     current_step_key = :stepKey,
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = :availableAt,
 *     updated_at = now(),
 *     completed_at = NULL
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'failed',
 *     output = NULL,
 *     error = :error,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'step.retry_scheduled',
 *     jsonb_build_object('availableAt', to_jsonb(:availableAt))
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const retryTransactionalTask = new PreparedQuery<IRetryTransactionalTaskParams,IRetryTransactionalTaskResult>(retryTransactionalTaskIR);


/** 'FailTransactionalTask' parameters type */
export interface IFailTransactionalTaskParams {
  attemptId?: string | null | void;
  error?: Json | null | void;
  runId?: string | null | void;
  stepKey?: string | null | void;
  workerId?: string | null | void;
}

/** 'FailTransactionalTask' return type */
export interface IFailTransactionalTaskResult {
  availableAt: Date;
  branchedFromAttemptId: string | null;
  branchedFromAttemptRunId: string | null;
  branchedFromRunId: string | null;
  cancelMode: string | null;
  cancelRequestedAt: Date | null;
  completedAt: Date | null;
  context: Json;
  continuedFromRunId: string | null;
  createdAt: Date;
  currentStepKey: string | null;
  definitionName: string;
  definitionVersion: number;
  error: Json | null;
  id: string;
  input: Json;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  parentRunId: string | null;
  parentStepKey: string | null;
  priority: number;
  result: Json | null;
  status: workflow_run_status;
  supersededByRunId: string | null;
  taskQueue: string;
  updatedAt: Date;
}

/** 'FailTransactionalTask' query type */
export interface IFailTransactionalTaskQuery {
  params: IFailTransactionalTaskParams;
  result: IFailTransactionalTaskResult;
}

const failTransactionalTaskIR: any = {"usedParamSet":{"error":true,"runId":true,"stepKey":true,"workerId":true,"attemptId":true},"params":[{"name":"error","required":false,"transform":{"type":"scalar"},"locs":[{"a":86,"b":91},{"a":1347,"b":1352},{"a":1606,"b":1611}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":235,"b":240}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":269,"b":276},{"a":1581,"b":1588}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":300,"b":308}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1417,"b":1426}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'failed',\n    error = :error,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    cancel_requested_at AS \"cancelRequestedAt\",\n    cancel_mode AS \"cancelMode\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'failed',\n    output = NULL,\n    error = :error,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, 'step.failed', :error\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

/**
 * Query generated from SQL:
 * ```
 * WITH updated_run AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'failed',
 *     error = :error,
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id = :runId
 *     AND current_step_key = :stepKey
 *     AND lease_owner = :workerId
 *     AND lease_expires_at >= now()
 *   RETURNING
 *     id,
 *     parent_run_id AS "parentRunId",
 *     parent_step_key AS "parentStepKey",
 *     continued_from_run_id AS "continuedFromRunId",
 *     branched_from_run_id AS "branchedFromRunId",
 *     branched_from_attempt_run_id AS "branchedFromAttemptRunId",
 *     branched_from_attempt_id AS "branchedFromAttemptId",
 *     superseded_by_run_id AS "supersededByRunId",
 *     definition_name AS "definitionName",
 *     definition_version AS "definitionVersion",
 *     task_queue AS "taskQueue",
 *     priority,
 *     status,
 *     current_step_key AS "currentStepKey",
 *     input,
 *     context,
 *     result,
 *     error,
 *     lease_owner AS "leaseOwner",
 *     lease_expires_at AS "leaseExpiresAt",
 *     cancel_requested_at AS "cancelRequestedAt",
 *     cancel_mode AS "cancelMode",
 *     available_at AS "availableAt",
 *     created_at AS "createdAt",
 *     updated_at AS "updatedAt",
 *     completed_at AS "completedAt"
 * ), updated_attempt AS (
 *   UPDATE workflow_step_attempts
 *   SET
 *     status = 'failed',
 *     output = NULL,
 *     error = :error,
 *     completed_at = now(),
 *     updated_at = now()
 *   WHERE id = :attemptId
 *     AND run_id IN (SELECT id FROM updated_run)
 * ), inserted_event AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT id, :stepKey, 'step.failed', :error
 *   FROM updated_run
 * )
 * SELECT * FROM updated_run
 * ```
 */
export const failTransactionalTask = new PreparedQuery<IFailTransactionalTaskParams,IFailTransactionalTaskResult>(failTransactionalTaskIR);


/** 'GetKv' parameters type */
export interface IGetKvParams {
  key?: string | null | void;
  runId?: string | null | void;
}

/** 'GetKv' return type */
export interface IGetKvResult {
  value: Json;
}

/** 'GetKv' query type */
export interface IGetKvQuery {
  params: IGetKvParams;
  result: IGetKvResult;
}

const getKvIR: any = {"usedParamSet":{"runId":true,"key":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":49,"b":54}]},{"name":"key","required":false,"transform":{"type":"scalar"},"locs":[{"a":66,"b":69}]}],"statement":"SELECT value FROM workflow_run_kv\nWHERE run_id = :runId AND key = :key"};

/**
 * Query generated from SQL:
 * ```
 * SELECT value FROM workflow_run_kv
 * WHERE run_id = :runId AND key = :key
 * ```
 */
export const getKv = new PreparedQuery<IGetKvParams,IGetKvResult>(getKvIR);


/** 'SetKv' parameters type */
export interface ISetKvParams {
  key?: string | null | void;
  runId?: string | null | void;
  value?: Json | null | void;
}

/** 'SetKv' return type */
export type ISetKvResult = void;

/** 'SetKv' query type */
export interface ISetKvQuery {
  params: ISetKvParams;
  result: ISetKvResult;
}

const setKvIR: any = {"usedParamSet":{"runId":true,"key":true,"value":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":69,"b":74}]},{"name":"key","required":false,"transform":{"type":"scalar"},"locs":[{"a":77,"b":80}]},{"name":"value","required":false,"transform":{"type":"scalar"},"locs":[{"a":83,"b":88}]}],"statement":"INSERT INTO workflow_run_kv (run_id, key, value, updated_at)\nVALUES (:runId, :key, :value, now())\nON CONFLICT (run_id, key) DO UPDATE SET\n  value = EXCLUDED.value,\n  updated_at = now()"};

/**
 * Query generated from SQL:
 * ```
 * INSERT INTO workflow_run_kv (run_id, key, value, updated_at)
 * VALUES (:runId, :key, :value, now())
 * ON CONFLICT (run_id, key) DO UPDATE SET
 *   value = EXCLUDED.value,
 *   updated_at = now()
 * ```
 */
export const setKv = new PreparedQuery<ISetKvParams,ISetKvResult>(setKvIR);


/** 'DeleteKv' parameters type */
export interface IDeleteKvParams {
  key?: string | null | void;
  runId?: string | null | void;
}

/** 'DeleteKv' return type */
export type IDeleteKvResult = void;

/** 'DeleteKv' query type */
export interface IDeleteKvQuery {
  params: IDeleteKvParams;
  result: IDeleteKvResult;
}

const deleteKvIR: any = {"usedParamSet":{"runId":true,"key":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":43,"b":48}]},{"name":"key","required":false,"transform":{"type":"scalar"},"locs":[{"a":60,"b":63}]}],"statement":"DELETE FROM workflow_run_kv\nWHERE run_id = :runId AND key = :key"};

/**
 * Query generated from SQL:
 * ```
 * DELETE FROM workflow_run_kv
 * WHERE run_id = :runId AND key = :key
 * ```
 */
export const deleteKv = new PreparedQuery<IDeleteKvParams,IDeleteKvResult>(deleteKvIR);


