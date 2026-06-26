/** Types generated for queries found in "src/sql/workflow-store.sql" */
import { PreparedQuery } from '@pgtyped/runtime';

export type step_attempt_kind = 'compensate' | 'forward';

export type step_attempt_status = 'completed' | 'failed' | 'started';

export type workflow_run_status = 'canceled' | 'compensation_failed' | 'completed' | 'failed' | 'queued' | 'running' | 'waiting';

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
  updatedAt: Date;
}

/** 'InsertRun' query type */
export interface IInsertRunQuery {
  params: IInsertRunParams;
  result: IInsertRunResult;
}

const insertRunIR: any = {"usedParamSet":{"parentRunId":true,"parentStepKey":true,"definitionName":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"idempotencyKey":true,"input":true},"params":[{"name":"parentRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":212,"b":223}]},{"name":"parentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":228,"b":241}]},{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":246,"b":260}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":265,"b":282}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":287,"b":296}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":301,"b":309}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":326,"b":340}]},{"name":"idempotencyKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":345,"b":359}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":364,"b":369}]}],"statement":"INSERT INTO workflow_runs (\n  parent_run_id,\n  parent_step_key,\n  definition_name,\n  definition_version,\n  task_queue,\n  priority,\n  status,\n  current_step_key,\n  idempotency_key,\n  input,\n  context\n) VALUES (\n  :parentRunId,\n  :parentStepKey,\n  :definitionName,\n  :definitionVersion,\n  :taskQueue,\n  :priority,\n  'queued',\n  :currentStepKey,\n  :idempotencyKey,\n  :input,\n  '{}'::jsonb\n)\nON CONFLICT (definition_name, idempotency_key)\nDO UPDATE SET\n  idempotency_key = workflow_runs.idempotency_key\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\""};

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
 *   context
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
 *   '{}'::jsonb
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
 *   completed_at AS "completedAt"
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
  updatedAt: Date;
}

/** 'GetRunById' query type */
export interface IGetRunByIdQuery {
  params: IGetRunByIdParams;
  result: IGetRunByIdResult;
}

const getRunByIdIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":860,"b":865}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE id = :runId"};

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
  updatedAt: Date;
}

/** 'GetRunAttempts' query type */
export interface IGetRunAttemptsQuery {
  params: IGetRunAttemptsParams;
  result: IGetRunAttemptsResult;
}

const getRunAttemptsIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":382,"b":387}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\"\nFROM workflow_step_attempts\nWHERE run_id = :runId\nORDER BY step_seq ASC, attempt ASC, created_at ASC"};

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
 *   updated_at AS "updatedAt"
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
  updatedAt: Date;
}

/** 'ClaimNextRunnableRun' query type */
export interface IClaimNextRunnableRunQuery {
  params: IClaimNextRunnableRunParams;
  result: IClaimNextRunnableRunResult;
}

const claimNextRunnableRunIR: any = {"usedParamSet":{"taskQueues":true,"workerId":true,"leaseMs":true},"params":[{"name":"taskQueues","required":false,"transform":{"type":"scalar"},"locs":[{"a":118,"b":128}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":428,"b":436}]},{"name":"leaseMs","required":false,"transform":{"type":"scalar"},"locs":[{"a":469,"b":476}]}],"statement":"WITH candidate AS (\n  SELECT id\n  FROM workflow_runs\n  WHERE status IN ('queued', 'running')\n    AND task_queue = ANY(:taskQueues)\n    AND current_step_key IS NOT NULL\n    AND available_at <= now()\n    AND (lease_expires_at IS NULL OR lease_expires_at < now())\n  ORDER BY priority DESC, available_at ASC, created_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT 1\n)\nUPDATE workflow_runs AS runs\nSET\n  status = 'running',\n  lease_owner = :workerId,\n  lease_expires_at = now() + (:leaseMs * interval '1 millisecond'),\n  updated_at = now()\nFROM candidate\nWHERE runs.id = candidate.id\nRETURNING\n  runs.id,\n  runs.parent_run_id AS \"parentRunId\",\n  runs.parent_step_key AS \"parentStepKey\",\n  runs.continued_from_run_id AS \"continuedFromRunId\",\n  runs.branched_from_run_id AS \"branchedFromRunId\",\n  runs.branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  runs.branched_from_attempt_id AS \"branchedFromAttemptId\",\n  runs.superseded_by_run_id AS \"supersededByRunId\",\n  runs.definition_name AS \"definitionName\",\n  runs.definition_version AS \"definitionVersion\",\n  runs.task_queue AS \"taskQueue\",\n  runs.priority,\n  runs.status,\n  runs.current_step_key AS \"currentStepKey\",\n  runs.input,\n  runs.context,\n  runs.result,\n  runs.error,\n  runs.lease_owner AS \"leaseOwner\",\n  runs.lease_expires_at AS \"leaseExpiresAt\",\n  runs.available_at AS \"availableAt\",\n  runs.created_at AS \"createdAt\",\n  runs.updated_at AS \"updatedAt\",\n  runs.completed_at AS \"completedAt\""};

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
 *   runs.completed_at AS "completedAt"
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
}

/** 'InsertStepAttempt' return type */
export interface IInsertStepAttemptResult {
  attempt: number;
  completedAt: Date | null;
  contextBefore: Json;
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
  stepSeq: number;
  updatedAt: Date;
}

/** 'InsertStepAttempt' query type */
export interface IInsertStepAttemptQuery {
  params: IInsertStepAttemptParams;
  result: IInsertStepAttemptResult;
}

const insertStepAttemptIR: any = {"usedParamSet":{"runId":true,"stepKey":true,"kind":true,"stepSeq":true,"attempt":true,"contextBefore":true,"input":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":139,"b":144}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":149,"b":156}]},{"name":"kind","required":false,"transform":{"type":"scalar"},"locs":[{"a":161,"b":165}]},{"name":"stepSeq","required":false,"transform":{"type":"scalar"},"locs":[{"a":170,"b":177}]},{"name":"attempt","required":false,"transform":{"type":"scalar"},"locs":[{"a":182,"b":189}]},{"name":"contextBefore","required":false,"transform":{"type":"scalar"},"locs":[{"a":207,"b":220}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":225,"b":230}]}],"statement":"INSERT INTO workflow_step_attempts (\n  run_id,\n  step_key,\n  kind,\n  step_seq,\n  attempt,\n  status,\n  context_before,\n  input\n) VALUES (\n  :runId,\n  :stepKey,\n  :kind,\n  :stepSeq,\n  :attempt,\n  'started',\n  :contextBefore,\n  :input\n)\nRETURNING\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\""};

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
 *   input
 * ) VALUES (
 *   :runId,
 *   :stepKey,
 *   :kind,
 *   :stepSeq,
 *   :attempt,
 *   'started',
 *   :contextBefore,
 *   :input
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
 *   updated_at AS "updatedAt"
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
  updatedAt: Date;
}

/** 'GetStepAttemptByIdForRun' query type */
export interface IGetStepAttemptByIdForRunQuery {
  params: IGetStepAttemptByIdForRunParams;
  result: IGetStepAttemptByIdForRunResult;
}

const getStepAttemptByIdForRunIR: any = {"usedParamSet":{"runId":true,"attemptId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":382,"b":387}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":400,"b":409}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  kind,\n  step_seq AS \"stepSeq\",\n  attempt,\n  status,\n  context_before AS \"contextBefore\",\n  input,\n  output,\n  error,\n  started_at AS \"startedAt\",\n  last_heartbeat_at AS \"lastHeartbeatAt\",\n  completed_at AS \"completedAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\"\nFROM workflow_step_attempts\nWHERE run_id = :runId\n  AND id = :attemptId"};

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
 *   updated_at AS "updatedAt"
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
  updatedAt: Date;
}

/** 'InsertBranchedRun' query type */
export interface IInsertBranchedRunQuery {
  params: IInsertBranchedRunParams;
  result: IInsertBranchedRunResult;
}

const insertBranchedRunIR: any = {"usedParamSet":{"branchedFromRunId":true,"branchedFromAttemptRunId":true,"branchedFromAttemptId":true,"definitionName":true,"definitionVersion":true,"taskQueue":true,"priority":true,"currentStepKey":true,"input":true,"context":true},"params":[{"name":"branchedFromRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":241,"b":258}]},{"name":"branchedFromAttemptRunId","required":false,"transform":{"type":"scalar"},"locs":[{"a":263,"b":287}]},{"name":"branchedFromAttemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":292,"b":313}]},{"name":"definitionName","required":false,"transform":{"type":"scalar"},"locs":[{"a":318,"b":332}]},{"name":"definitionVersion","required":false,"transform":{"type":"scalar"},"locs":[{"a":337,"b":354}]},{"name":"taskQueue","required":false,"transform":{"type":"scalar"},"locs":[{"a":359,"b":368}]},{"name":"priority","required":false,"transform":{"type":"scalar"},"locs":[{"a":373,"b":381}]},{"name":"currentStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":398,"b":412}]},{"name":"input","required":false,"transform":{"type":"scalar"},"locs":[{"a":417,"b":422}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":427,"b":434}]}],"statement":"INSERT INTO workflow_runs (\n  branched_from_run_id,\n  branched_from_attempt_run_id,\n  branched_from_attempt_id,\n  definition_name,\n  definition_version,\n  task_queue,\n  priority,\n  status,\n  current_step_key,\n  input,\n  context\n) VALUES (\n  :branchedFromRunId,\n  :branchedFromAttemptRunId,\n  :branchedFromAttemptId,\n  :definitionName,\n  :definitionVersion,\n  :taskQueue,\n  :priority,\n  'queued',\n  :currentStepKey,\n  :input,\n  :context\n)\nRETURNING\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\""};

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
 *   context
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
 *   :context
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
 *   completed_at AS "completedAt"
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

const openWaitIR: any = {"usedParamSet":{"stepKey":true,"context":true,"runId":true,"workerId":true,"correlationKey":true,"payload":true,"expiresAt":true,"output":true,"attemptId":true,"eventType":true,"eventPayload":true},"params":[{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":105},{"a":318,"b":325},{"a":1356,"b":1363},{"a":1800,"b":1807}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":122,"b":129}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":284,"b":289}]},{"name":"workerId","required":false,"transform":{"type":"scalar"},"locs":[{"a":349,"b":357}]},{"name":"correlationKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":1366,"b":1380}]},{"name":"payload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1391,"b":1398}]},{"name":"expiresAt","required":false,"transform":{"type":"scalar"},"locs":[{"a":1401,"b":1410}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":1532,"b":1538}]},{"name":"attemptId","required":false,"transform":{"type":"scalar"},"locs":[{"a":1621,"b":1630}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1810,"b":1819}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1822,"b":1834}]}],"statement":"WITH updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'waiting',\n    current_step_key = :stepKey,\n    context = :context,\n    result = NULL,\n    error = NULL,\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND current_step_key = :stepKey\n    AND lease_owner = :workerId\n    AND lease_expires_at >= now()\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_wait AS (\n  INSERT INTO workflow_waits (\n    run_id,\n    step_key,\n    correlation_key,\n    status,\n    payload,\n    expires_at\n  )\n  SELECT id, :stepKey, :correlationKey, 'open', :payload, :expiresAt\n  FROM updated_run\n), updated_attempt AS (\n  UPDATE workflow_step_attempts\n  SET\n    status = 'completed',\n    output = :output,\n    error = NULL,\n    completed_at = now(),\n    updated_at = now()\n  WHERE id = :attemptId\n    AND run_id IN (SELECT id FROM updated_run)\n  RETURNING id\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

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
 *     expires_at
 *   )
 *   SELECT id, :stepKey, :correlationKey, 'open', :payload, :expiresAt
 *   FROM updated_run
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
export const openWait = new PreparedQuery<IOpenWaitParams,IOpenWaitResult>(openWaitIR);


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

const getOpenWaitForUpdateIR: any = {"usedParamSet":{"correlationKey":true},"params":[{"name":"correlationKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":350,"b":364}]}],"statement":"SELECT\n  id,\n  run_id AS \"runId\",\n  step_key AS \"stepKey\",\n  correlation_key AS \"correlationKey\",\n  status,\n  payload,\n  resume_payload AS \"resumePayload\",\n  resume_output AS \"resumeOutput\",\n  expires_at AS \"expiresAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  resumed_at AS \"resumedAt\"\nFROM workflow_waits\nWHERE correlation_key = :correlationKey\nFOR UPDATE"};

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
 *   resumed_at AS "resumedAt"
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
  updatedAt: Date;
}

/** 'GetRunByIdForUpdate' query type */
export interface IGetRunByIdForUpdateQuery {
  params: IGetRunByIdForUpdateParams;
  result: IGetRunByIdForUpdateResult;
}

const getRunByIdForUpdateIR: any = {"usedParamSet":{"runId":true},"params":[{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":860,"b":865}]}],"statement":"SELECT\n  id,\n  parent_run_id AS \"parentRunId\",\n  parent_step_key AS \"parentStepKey\",\n  continued_from_run_id AS \"continuedFromRunId\",\n  branched_from_run_id AS \"branchedFromRunId\",\n  branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n  branched_from_attempt_id AS \"branchedFromAttemptId\",\n  superseded_by_run_id AS \"supersededByRunId\",\n  definition_name AS \"definitionName\",\n  definition_version AS \"definitionVersion\",\n  task_queue AS \"taskQueue\",\n  priority,\n  status,\n  current_step_key AS \"currentStepKey\",\n  input,\n  context,\n  result,\n  error,\n  lease_owner AS \"leaseOwner\",\n  lease_expires_at AS \"leaseExpiresAt\",\n  cancel_requested_at AS \"cancelRequestedAt\",\n  cancel_mode AS \"cancelMode\",\n  available_at AS \"availableAt\",\n  created_at AS \"createdAt\",\n  updated_at AS \"updatedAt\",\n  completed_at AS \"completedAt\"\nFROM workflow_runs\nWHERE id = :runId\nFOR UPDATE"};

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

const completeWaitResumeIR: any = {"usedParamSet":{"resumePayload":true,"output":true,"waitId":true,"nextStepKey":true,"context":true,"runId":true,"stepKey":true,"eventType":true,"eventPayload":true},"params":[{"name":"resumePayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":98,"b":111}]},{"name":"output","required":false,"transform":{"type":"scalar"},"locs":[{"a":134,"b":140}]},{"name":"waitId","required":false,"transform":{"type":"scalar"},"locs":[{"a":203,"b":209}]},{"name":"nextStepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":345,"b":356}]},{"name":"context","required":false,"transform":{"type":"scalar"},"locs":[{"a":373,"b":380}]},{"name":"runId","required":false,"transform":{"type":"scalar"},"locs":[{"a":463,"b":468}]},{"name":"stepKey","required":false,"transform":{"type":"scalar"},"locs":[{"a":524,"b":531},{"a":1489,"b":1496}]},{"name":"eventType","required":false,"transform":{"type":"scalar"},"locs":[{"a":1499,"b":1508}]},{"name":"eventPayload","required":false,"transform":{"type":"scalar"},"locs":[{"a":1511,"b":1523}]}],"statement":"WITH updated_wait AS (\n  UPDATE workflow_waits\n  SET\n    status = 'resumed',\n    resume_payload = :resumePayload,\n    resume_output = :output,\n    resumed_at = now(),\n    updated_at = now()\n  WHERE id = :waitId\n    AND status = 'open'\n  RETURNING id\n), updated_run AS (\n  UPDATE workflow_runs\n  SET\n    status = 'queued',\n    current_step_key = :nextStepKey,\n    context = :context,\n    error = NULL,\n    available_at = now(),\n    updated_at = now()\n  WHERE id = :runId\n    AND status = 'waiting'\n    AND current_step_key = :stepKey\n    AND EXISTS (SELECT 1 FROM updated_wait)\n  RETURNING\n    id,\n    parent_run_id AS \"parentRunId\",\n    parent_step_key AS \"parentStepKey\",\n    continued_from_run_id AS \"continuedFromRunId\",\n    branched_from_run_id AS \"branchedFromRunId\",\n    branched_from_attempt_run_id AS \"branchedFromAttemptRunId\",\n    branched_from_attempt_id AS \"branchedFromAttemptId\",\n    superseded_by_run_id AS \"supersededByRunId\",\n    definition_name AS \"definitionName\",\n    definition_version AS \"definitionVersion\",\n    task_queue AS \"taskQueue\",\n    priority,\n    status,\n    current_step_key AS \"currentStepKey\",\n    input,\n    context,\n    result,\n    error,\n    lease_owner AS \"leaseOwner\",\n    lease_expires_at AS \"leaseExpiresAt\",\n    available_at AS \"availableAt\",\n    created_at AS \"createdAt\",\n    updated_at AS \"updatedAt\",\n    completed_at AS \"completedAt\"\n), inserted_event AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT id, :stepKey, :eventType, :eventPayload\n  FROM updated_run\n)\nSELECT * FROM updated_run"};

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
  expiredCount: number | null;
}

/** 'ExpireOpenWaits' query type */
export interface IExpireOpenWaitsQuery {
  params: IExpireOpenWaitsParams;
  result: IExpireOpenWaitsResult;
}

const expireOpenWaitsIR: any = {"usedParamSet":{"limit":true},"params":[{"name":"limit","required":false,"transform":{"type":"scalar"},"locs":[{"a":241,"b":246}]}],"statement":"WITH expired_waits AS (\n  SELECT id, run_id AS \"runId\", step_key AS \"stepKey\"\n  FROM workflow_waits\n  WHERE status = 'open'\n    AND expires_at IS NOT NULL\n    AND expires_at < now()\n  ORDER BY expires_at ASC\n  FOR UPDATE SKIP LOCKED\n  LIMIT :limit\n), updated_waits AS (\n  UPDATE workflow_waits\n  SET\n    status = 'expired',\n    updated_at = now()\n  WHERE id IN (SELECT id FROM expired_waits)\n  RETURNING id\n), updated_runs AS (\n  UPDATE workflow_runs\n  SET\n    status = 'failed',\n    error = jsonb_build_object('message', 'Wait step expired'),\n    lease_owner = NULL,\n    lease_expires_at = NULL,\n    available_at = now(),\n    updated_at = now(),\n    completed_at = now()\n  WHERE id IN (SELECT \"runId\" FROM expired_waits)\n    AND status = 'waiting'\n  RETURNING id\n), inserted_events AS (\n  INSERT INTO workflow_events (run_id, step_key, event_type, payload)\n  SELECT \"runId\", \"stepKey\", 'wait.expired', '{}'::jsonb\n  FROM expired_waits\n)\nSELECT COUNT(*)::int AS \"expiredCount\"\nFROM updated_waits"};

/**
 * Query generated from SQL:
 * ```
 * WITH expired_waits AS (
 *   SELECT id, run_id AS "runId", step_key AS "stepKey"
 *   FROM workflow_waits
 *   WHERE status = 'open'
 *     AND expires_at IS NOT NULL
 *     AND expires_at < now()
 *   ORDER BY expires_at ASC
 *   FOR UPDATE SKIP LOCKED
 *   LIMIT :limit
 * ), updated_waits AS (
 *   UPDATE workflow_waits
 *   SET
 *     status = 'expired',
 *     updated_at = now()
 *   WHERE id IN (SELECT id FROM expired_waits)
 *   RETURNING id
 * ), updated_runs AS (
 *   UPDATE workflow_runs
 *   SET
 *     status = 'failed',
 *     error = jsonb_build_object('message', 'Wait step expired'),
 *     lease_owner = NULL,
 *     lease_expires_at = NULL,
 *     available_at = now(),
 *     updated_at = now(),
 *     completed_at = now()
 *   WHERE id IN (SELECT "runId" FROM expired_waits)
 *     AND status = 'waiting'
 *   RETURNING id
 * ), inserted_events AS (
 *   INSERT INTO workflow_events (run_id, step_key, event_type, payload)
 *   SELECT "runId", "stepKey", 'wait.expired', '{}'::jsonb
 *   FROM expired_waits
 * )
 * SELECT COUNT(*)::int AS "expiredCount"
 * FROM updated_waits
 * ```
 */
export const expireOpenWaits = new PreparedQuery<IExpireOpenWaitsParams,IExpireOpenWaitsResult>(expireOpenWaitsIR);


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

