import type { Pool, PoolClient } from "pg"

import {
  advanceTaskStepQuery,
  cancelRunQuery,
  claimNextRunnableRunQuery,
  completeRunQuery,
  completeWaitResumeQuery,
  consumeSignalQuery,
  countOpenWaitsQuery,
  createSignalQuery,
  extendLeaseQuery,
  expireOpenWaitsQuery,
  failRunQuery,
  getLastStepAttemptQuery,
  getOpenWaitForUpdateQuery,
  getRunByIdForUpdateQuery,
  getRunByIdQuery,
  getRunAttemptsQuery,
  getRunEventsQuery,
  insertEventQuery,
  insertRunQuery,
  insertStepAttemptQuery,
  listActiveRunsQuery,
  listFailedRunsQuery,
  listStuckRunsQuery,
  openWaitQuery,
  pingQuery,
  recoverExpiredLeasesQuery,
  retryRunQuery,
  scheduleRetryQuery,
  scheduleSleepQuery,
  type IAttemptRow,
  type IEventRow,
  type IRunRow,
  type IWaitRow,
} from "../queries/workflow-store.queries.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  RetryPolicy,
  StepExecutionContext,
  TaskStepResult,
  WorkflowCancelMode,
  WorkflowOutboxRecord,
  SignalRecord,
  StepAttemptStatus,
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkflowScheduleRecord,
  WorkflowRunStatus,
  WorkflowStepAttemptRecord,
  WorkflowWaitRecord,
} from "../types/workflow.js"
import type { Database } from "./db.js"
import { withTransaction } from "./db.js"

const requireRow = <T>(row: T | undefined, message: string): T => {
  if (!row) {
    throw new Error(message)
  }

  return row
}

const assertJsonObject = (value: JsonValue, message: string): JsonObject => {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(message)
  }

  return value as JsonObject
}

const mapRun = (row: IRunRow): WorkflowRunRecord => ({
  ...row,
  parentRunId: row.parentRunId ?? null,
  parentStepKey:
    "parentStepKey" in row && typeof row.parentStepKey === "string"
      ? row.parentStepKey
      : null,
  status: row.status as WorkflowRunStatus,
  input: assertJsonObject(row.input, "Run input must be a JSON object"),
  context: assertJsonObject(row.context, "Run context must be a JSON object"),
  result: row.result,
  error: row.error,
  cancelRequestedAt: row.cancelRequestedAt ?? null,
  cancelMode: (row.cancelMode as WorkflowCancelMode | null | undefined) ?? null,
})

const mapAttempt = (row: IAttemptRow): WorkflowStepAttemptRecord => ({
  ...row,
  status: row.status as StepAttemptStatus,
  input: assertJsonObject(row.input, "Attempt input must be a JSON object"),
  output: row.output,
  error: row.error,
  lastHeartbeatAt: row.lastHeartbeatAt ?? null,
})

const mapWait = (row: IWaitRow): WorkflowWaitRecord => ({
  ...row,
  payload: row.payload,
  resumePayload: row.resumePayload,
  resumeOutput: row.resumeOutput,
  expiresAt: row.expiresAt ?? null,
})

const mapSignal = (row: {
  id: string
  runId: string
  signalName: string
  payload: JsonValue | null
  consumedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): SignalRecord => ({
  ...row,
  payload: row.payload,
})

const mapEvent = (row: IEventRow): WorkflowEventRecord => ({
  ...row,
  payload: assertJsonObject(row.payload, "Event payload must be a JSON object"),
})

const insertAttempt = async (
  client: PoolClient,
  args: {
    runId: string
    stepKey: string
    input: JsonObject
  }
) => {
  const [countRow] = await getLastStepAttemptQuery.run(
    { runId: args.runId, stepKey: args.stepKey },
    client
  )
  const attempt = (countRow?.lastAttempt ?? 0) + 1
  const [row] = await insertStepAttemptQuery.run(
    {
      runId: args.runId,
      stepKey: args.stepKey,
      attempt,
      input: args.input,
    },
    client
  )

  return mapAttempt(requireRow(row, "Failed to insert step attempt"))
}

type Queryable = Pool | PoolClient

const queryRows = async <TRow extends object>(
  db: Queryable,
  text: string,
  values: readonly unknown[] = []
) => {
  const result = await db.query<TRow>(text, [...values])
  return result.rows
}

const mapSchedule = (row: {
  id: string
  workflowName: string
  cronExpression: string
  payload: JsonValue
  active: boolean
  nextFireAt: Date
  createdAt: Date
  updatedAt: Date
}): WorkflowScheduleRecord => ({
  ...row,
  payload: assertJsonObject(row.payload, "Schedule payload must be a JSON object"),
})

const mapOutbox = (row: {
  id: string
  runId: string | null
  topic: string
  payload: JsonValue
  availableAt: Date
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}): WorkflowOutboxRecord => ({
  ...row,
  payload: assertJsonObject(row.payload, "Outbox payload must be a JSON object"),
})

const withPromiseTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  label: string
) => {
  if (timeoutMs === undefined) {
    return promise
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`))
    }, timeoutMs)

    void promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export class LostLeaseError extends Error {}

export const createWorkflowStore = (
  db: Database,
  options: {
    notifyRunnable?: () => Promise<void>
    notifyRunEvent?: (runId: string) => Promise<void>
  } = {}
) => {
  const notifyRunnable = async () => {
    await options.notifyRunnable?.()
  }

  const notifyRunEvent = async (runId: string) => {
    await options.notifyRunEvent?.(runId)
  }

  const startRun = async (args: {
    parentRunId?: string | null
    parentStepKey?: string | null
    definitionName: string
    definitionVersion: number
    input: JsonObject
    currentStepKey: string
  }) =>
    withTransaction(db, async (client) => {
      const [runRow] = await insertRunQuery.run(args, client)
      const run = mapRun(requireRow(runRow, "Failed to insert workflow run"))

      await insertEventQuery.run(
        {
          runId: run.id,
          stepKey: run.currentStepKey,
          eventType: "run.started",
          payload: {},
        },
        client
      )

      await notifyRunnable()
      await notifyRunEvent(run.id)
      return run
    })

  const getRun = async (runId: string) => {
    const [row] = await getRunByIdQuery.run({ runId }, db)
    return row ? mapRun(row) : null
  }

  const getRunEvents = async (runId: string) => {
    const rows = await getRunEventsQuery.run({ runId }, db)
    return rows.map(mapEvent)
  }

  const getRunAttempts = async (runId: string) => {
    const rows = await getRunAttemptsQuery.run({ runId }, db)
    return rows.map(mapAttempt)
  }

  const ping = async () => {
    const [row] = await pingQuery.run(undefined, db)
    return requireRow(row, "Database ping failed").ok === 1
  }

  const claimNextRunnableRun = async (args: {
    workerId: string
    leaseMs: number
  }) =>
    withTransaction(db, async (client) => {
      const [row] = await claimNextRunnableRunQuery.run(args, client)
      return row ? mapRun(row) : null
    })

  const beginStepAttempt = async (args: {
    runId: string
    stepKey: string
    input: JsonObject
  }) => withTransaction(db, (client) => insertAttempt(client, args))

  const completeRun = async (args: {
    runId: string
    stepKey: string
    workerId: string
    context: JsonObject
    result: JsonValue | null
  }) => {
    const [row] = await completeRunQuery.run(
      {
        ...args,
        eventType: "run.completed",
        eventPayload: {},
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to complete run under active lease")
    }

    const run = (await getRun(mapRun(row).id)) ?? mapRun(row)
    await notifyRunEvent(run.id)
    await wakeParentForChild(run)
    return run
  }

  const advanceTaskStep = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    nextStepKey: string
    context: JsonObject
    output: JsonValue | null
  }) => {
    const [row] = await advanceTaskStepQuery.run(
      {
        ...args,
        eventType: "step.completed",
        eventPayload: { nextStepKey: args.nextStepKey },
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to advance task step under active lease")
    }

    const run = mapRun(row)
    await notifyRunnable()
    await notifyRunEvent(run.id)
    return run
  }

  const openWait = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    context: JsonObject
    correlationKey: string
    payload: JsonValue | null
    expiresAt: Date | null
    output: JsonValue | null
  }) => {
    const [row] = await openWaitQuery.run(
      {
        ...args,
        eventType: "wait.opened",
        eventPayload: { correlationKey: args.correlationKey },
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to open wait under active lease")
    }

    const run = mapRun(row)
    await notifyRunEvent(run.id)
    return run
  }

  const scheduleRetry = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    availableAt: Date
    error: JsonObject
  }) => {
    const [row] = await scheduleRetryQuery.run(
      {
        ...args,
        eventType: "step.retry_scheduled",
        eventPayload: { availableAt: args.availableAt.toISOString() },
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to schedule retry under active lease")
    }

    const run = mapRun(row)
    await notifyRunEvent(run.id)
    return run
  }

  const failRun = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    error: JsonObject
  }) => {
    const [row] = await failRunQuery.run(
      {
        ...args,
        eventType: "step.failed",
        eventPayload: args.error,
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to mark run failed under active lease")
    }

    const run = mapRun(row)
    await notifyRunEvent(run.id)
    return run
  }

  const scheduleSleep = async (args: {
    runId: string
    stepKey: string
    workerId: string
    nextStepKey: string
    availableAt: Date
  }) => {
    const [row] = await scheduleSleepQuery.run(
      {
        ...args,
        eventType: "step.scheduled",
        eventPayload: { availableAt: args.availableAt.toISOString() },
      },
      db
    )

    if (!row) {
      throw new LostLeaseError("Failed to schedule sleep step under active lease")
    }

    const run = mapRun(row)
    await notifyRunEvent(run.id)
    return run
  }

  const resumeWait = async (args: {
    correlationKey: string
    payload: JsonValue | undefined
    resume: (
      run: WorkflowRunRecord,
      wait: WorkflowWaitRecord
    ) => Promise<{
      nextStepKey: string
      context: JsonObject
      output: JsonValue | null
    }>
  }) =>
    withTransaction(db, async (client) => {
      const [waitRow] = await getOpenWaitForUpdateQuery.run(
        { correlationKey: args.correlationKey },
        client
      )

      if (!waitRow) {
        return { status: "missing" as const, run: null }
      }

      const wait = mapWait(waitRow)
      const [runRow] = await getRunByIdForUpdateQuery.run(
        { runId: wait.runId },
        client
      )
      const run = mapRun(requireRow(runRow, "Failed to load waiting run"))

      if (wait.status !== "open") {
        return { status: "duplicate" as const, run }
      }

      if (run.status !== "waiting" || run.currentStepKey !== wait.stepKey) {
        return { status: "duplicate" as const, run }
      }

      const resumed = await args.resume(run, wait)

      const [updatedRow] = await completeWaitResumeQuery.run(
        {
          waitId: wait.id,
          runId: run.id,
          stepKey: wait.stepKey,
          nextStepKey: resumed.nextStepKey,
          context: resumed.context,
          resumePayload: args.payload ?? null,
          output: resumed.output,
          eventType: "wait.resumed",
          eventPayload: {
            nextStepKey: resumed.nextStepKey,
            resumePayload: args.payload ?? null,
          },
        },
        client
      )

      if (!updatedRow) {
        return { status: "duplicate" as const, run }
      }

      const resumedRun = mapRun(updatedRow)
      await notifyRunnable()
      await notifyRunEvent(resumedRun.id)
      return { status: "resumed" as const, run: resumedRun }
    })

  const consumeSignalAndResumeWait = async (args: {
    correlationKey: string
    signalName: string
    resume: (signalPayload: JsonValue | undefined) => Promise<{
      nextStepKey: string
      context: JsonObject
      output: JsonValue | null
    }>
  }): Promise<{
    status: "resumed" | "no_signal" | "duplicate" | "missing"
    run: WorkflowRunRecord | null
  }> =>
    withTransaction(db, async (client) => {
      const [waitRow] = await getOpenWaitForUpdateQuery.run(
        { correlationKey: args.correlationKey },
        client
      )

      if (!waitRow) {
        return { status: "missing" as const, run: null }
      }

      const wait = mapWait(waitRow)
      const [runRow] = await getRunByIdForUpdateQuery.run(
        { runId: wait.runId },
        client
      )
      const run = mapRun(requireRow(runRow, "Failed to load waiting run"))

      if (wait.status !== "open") {
        return { status: "duplicate" as const, run }
      }

      if (run.status !== "waiting" || run.currentStepKey !== wait.stepKey) {
        return { status: "duplicate" as const, run }
      }

      const [signalRow] = await consumeSignalQuery.run(
        { runId: run.id, signalName: args.signalName },
        client
      )

      if (!signalRow) {
        return { status: "no_signal" as const, run }
      }

      const signal = mapSignal(signalRow)
      const resumed = await args.resume(signal.payload ?? undefined)

      const [updatedRow] = await completeWaitResumeQuery.run(
        {
          waitId: wait.id,
          runId: run.id,
          stepKey: wait.stepKey,
          nextStepKey: resumed.nextStepKey,
          context: resumed.context,
          resumePayload: signal.payload,
          output: resumed.output,
          eventType: "wait.resumed",
          eventPayload: {
            nextStepKey: resumed.nextStepKey,
            resumePayload: signal.payload,
          },
        },
        client
      )

      if (!updatedRow) {
        return { status: "duplicate" as const, run }
      }

      const resumedRun = mapRun(updatedRow)
      await notifyRunnable()
      await notifyRunEvent(resumedRun.id)
      return { status: "resumed" as const, run: resumedRun }
    })

  const countOpenWaits = async () => {
    const [row] = await countOpenWaitsQuery.run(undefined, db)
    return requireRow(row, "Failed to count open waits").waitCount
  }

  const extendLease = async (args: {
    runId: string
    stepKey: string
    attemptId: string
    workerId: string
    leaseMs: number
  }) => {
    const [row] = await extendLeaseQuery.run(args, db)
    return requireRow(row, "Failed to extend lease").ok === 1
  }

  const expireOpenWaits = async (args: { limit: number }) => {
    const [row] = await expireOpenWaitsQuery.run(args, db)
    return requireRow(row, "Failed to expire open waits").expiredCount
  }

  const createSignal = async (args: {
    runId: string
    signalName: string
    payload: JsonValue | null
  }) => {
    const [row] = await createSignalQuery.run(args, db)

    if (row) {
      await notifyRunnable()
      return row.runId
    }

    return null
  }

  const consumeSignal = async (args: {
    runId: string
    signalName: string
  }) => {
    const [row] = await consumeSignalQuery.run(args, db)
    return row ? mapSignal(row) : null
  }

  const getChildRun = async (args: {
    parentRunId: string
    parentStepKey: string
  }) => {
    const [row] = await queryRows<IRunRow>(
      db,
      `
        SELECT
          id,
          parent_run_id AS "parentRunId",
          parent_step_key AS "parentStepKey",
          definition_name AS "definitionName",
          definition_version AS "definitionVersion",
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
        WHERE parent_run_id = $1
          AND parent_step_key = $2
        ORDER BY created_at ASC
        LIMIT 1
      `,
      [args.parentRunId, args.parentStepKey]
    )

    if (!row) {
      return null
    }

    const run = mapRun(row)
    await notifyRunnable()
    await notifyRunEvent(run.id)
    return run
  }

  const listChildRuns = async (parentRunId: string) => {
    const rows = await queryRows<IRunRow>(
      db,
      `
        SELECT
          id,
          parent_run_id AS "parentRunId",
          parent_step_key AS "parentStepKey",
          definition_name AS "definitionName",
          definition_version AS "definitionVersion",
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
        WHERE parent_run_id = $1
        ORDER BY created_at ASC
      `,
      [parentRunId]
    )

    return rows.map(mapRun)
  }

  const wakeParentForChild = async (childRun: WorkflowRunRecord) => {
    if (!childRun.parentRunId || !childRun.parentStepKey) {
      return false
    }

    const payload = {
      childRunId: childRun.id,
      childStatus: childRun.status,
    }
    const correlationKey = `child:${childRun.parentRunId}:${childRun.parentStepKey}`
    const [row] = await queryRows<{ runId: string }>(
      db,
      `
        WITH updated_wait AS (
          UPDATE workflow_waits
          SET
            status = 'resumed',
            resume_payload = $2,
            resumed_at = now(),
            updated_at = now()
          WHERE correlation_key = $1
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
          SELECT "runId", "stepKey", 'child.completed', $2
          FROM updated_wait
          WHERE EXISTS (SELECT 1 FROM updated_run)
        )
        SELECT id AS "runId"
        FROM updated_run
      `,
      [correlationKey, payload]
    )

    if (row) {
      await notifyRunnable()
      await notifyRunEvent(row.runId)
      return true
    }

    return false
  }

  const requestCancelRun = async (args: {
    runId: string
    mode: WorkflowCancelMode
    reason?: string
  }) => {
    const eventType =
      args.mode === "hard" ? "run.canceled" : "run.cancel_requested"
    const eventPayload = {
      mode: args.mode,
      ...(args.reason ? { reason: args.reason } : {}),
    }
    const [row] = await queryRows<IRunRow>(
      db,
      `
        WITH updated_run AS (
          UPDATE workflow_runs
          SET
            cancel_requested_at = now(),
            cancel_mode = $2,
            status = CASE
              WHEN $2 = 'hard' THEN 'canceled'::workflow_run_status
              WHEN status = 'waiting' THEN 'queued'::workflow_run_status
              WHEN status = 'failed' THEN 'canceled'::workflow_run_status
              ELSE status
            END,
            lease_owner = CASE WHEN $2 = 'hard' THEN NULL ELSE lease_owner END,
            lease_expires_at = CASE WHEN $2 = 'hard' THEN NULL ELSE lease_expires_at END,
            available_at = now(),
            updated_at = now(),
            completed_at = CASE
              WHEN $2 = 'hard' OR status = 'failed' THEN now()
              ELSE completed_at
            END
          WHERE id = $1
            AND status IN ('queued', 'running', 'waiting', 'failed')
          RETURNING
            id,
            parent_run_id AS "parentRunId",
            parent_step_key AS "parentStepKey",
            definition_name AS "definitionName",
            definition_version AS "definitionVersion",
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
            status = CASE WHEN $2 = 'hard' THEN 'canceled'::workflow_wait_status ELSE status END,
            updated_at = now()
          WHERE run_id IN (SELECT id FROM updated_run)
            AND status = 'open'
        ), inserted_event AS (
          INSERT INTO workflow_events (run_id, step_key, event_type, payload)
          SELECT id, "currentStepKey", $3, $4
          FROM updated_run
        )
        SELECT * FROM updated_run
      `,
      [args.runId, args.mode, eventType, eventPayload]
    )

    if (row) {
      const run = mapRun(row)
      await notifyRunnable()
      await notifyRunEvent(run.id)

      if (args.mode === "hard") {
        await wakeParentForChild(run)
      }

      return run
    }

    return null
  }

  const cancelRunAtBoundary = async (args: {
    runId: string
    stepKey: string
    workerId: string
    mode: WorkflowCancelMode
  }) => {
    const [row] = await queryRows<IRunRow>(
      db,
      `
        WITH updated_run AS (
          UPDATE workflow_runs
          SET
            status = 'canceled',
            lease_owner = NULL,
            lease_expires_at = NULL,
            available_at = now(),
            updated_at = now(),
            completed_at = now()
          WHERE id = $1
            AND current_step_key = $2
            AND lease_owner = $3
            AND lease_expires_at >= now()
            AND cancel_requested_at IS NOT NULL
          RETURNING
            id,
            parent_run_id AS "parentRunId",
            parent_step_key AS "parentStepKey",
            definition_name AS "definitionName",
            definition_version AS "definitionVersion",
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
          SELECT id, $2, 'run.canceled', jsonb_build_object('mode', $4)
          FROM updated_run
        )
        SELECT * FROM updated_run
      `,
      [args.runId, args.stepKey, args.workerId, args.mode]
    )

    if (!row) {
      return null
    }

    const run = (await getRun(mapRun(row).id)) ?? mapRun(row)
    await notifyRunEvent(run.id)
    await wakeParentForChild(run)
    return run
  }

  const listActiveRuns = async (limit: number) => {
    const rows = await listActiveRunsQuery.run({ limit }, db)
    return rows.map(mapRun)
  }

  const listFailedRuns = async (limit: number) => {
    const rows = await listFailedRunsQuery.run({ limit }, db)
    return rows.map(mapRun)
  }

  const listStuckRuns = async (args: { limit: number; olderThanMs: number }) => {
    const rows = await listStuckRunsQuery.run(args, db)
    return rows.map(mapRun)
  }

  const enqueueOutbox = async (args: {
    runId?: string | null
    topic: string
    payload: JsonObject
    availableAt?: Date
    client?: PoolClient
  }) => {
    await queryRows(
      args.client ?? db,
      `
        INSERT INTO workflow_outbox (
          run_id,
          topic,
          payload,
          available_at
        ) VALUES (
          $1,
          $2,
          $3,
          COALESCE($4, now())
        )
        RETURNING
          id,
          run_id AS "runId",
          topic,
          payload,
          available_at AS "availableAt",
          delivered_at AS "deliveredAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [args.runId ?? null, args.topic, args.payload, args.availableAt ?? null]
    )
  }

  const queryStepDatabase = async <
    T extends object = Record<string, unknown>,
  >(
    text: string,
    values: readonly unknown[] = []
  ) => {
    const result = await db.query<T>(text, [...values])
    return {
      rows: result.rows,
    }
  }

  const claimOutboxMessages = async (limit: number) =>
    withTransaction(db, async (client) => {
      const rows = await queryRows<{
        id: string
        runId: string | null
        topic: string
        payload: JsonValue
        availableAt: Date
        deliveredAt: Date | null
        createdAt: Date
        updatedAt: Date
      }>(
        client,
        `
          WITH candidate AS (
            SELECT id
            FROM workflow_outbox
            WHERE delivered_at IS NULL
              AND available_at <= now()
            ORDER BY available_at ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
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
            updated_at AS "updatedAt"
        `,
        [limit]
      )

      return rows.map(mapOutbox)
    })

  const markOutboxDelivered = async (outboxId: string) => {
    const rows = await queryRows<{ delivered: number }>(
      db,
      `
        UPDATE workflow_outbox
        SET
          delivered_at = now(),
          updated_at = now()
        WHERE id = $1
          AND delivered_at IS NULL
        RETURNING 1::int AS delivered
      `,
      [outboxId]
    )

    return rows.length > 0
  }

  const createSchedule = async (args: {
    workflowName: string
    cronExpression: string
    payload?: JsonObject
    nextFireAt: Date
  }) => {
    const rows = await queryRows<{
      id: string
      workflowName: string
      cronExpression: string
      payload: JsonValue
      active: boolean
      nextFireAt: Date
      createdAt: Date
      updatedAt: Date
    }>(
      db,
      `
        INSERT INTO workflow_schedules (
          workflow_name,
          cron_expression,
          payload,
          next_fire_at
        ) VALUES (
          $1,
          $2,
          $3,
          $4
        )
        RETURNING
          id,
          workflow_name AS "workflowName",
          cron_expression AS "cronExpression",
          payload,
          active,
          next_fire_at AS "nextFireAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [args.workflowName, args.cronExpression, args.payload ?? {}, args.nextFireAt]
    )

    return mapSchedule(requireRow(rows[0], "Failed to create schedule"))
  }

  const listSchedules = async () => {
    const rows = await queryRows<{
      id: string
      workflowName: string
      cronExpression: string
      payload: JsonValue
      active: boolean
      nextFireAt: Date
      createdAt: Date
      updatedAt: Date
    }>(
      db,
      `
        SELECT
          id,
          workflow_name AS "workflowName",
          cron_expression AS "cronExpression",
          payload,
          active,
          next_fire_at AS "nextFireAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM workflow_schedules
        ORDER BY next_fire_at ASC, created_at ASC
      `
    )

    return rows.map(mapSchedule)
  }

  const fireDueSchedules = async (args: {
    limit: number
    getNextFireAt: (input: {
      schedule: WorkflowScheduleRecord
      now: Date
    }) => Date
  }) =>
    withTransaction(db, async (client) => {
      const scheduleRows = await queryRows<{
        id: string
        workflowName: string
        cronExpression: string
        payload: JsonValue
        active: boolean
        nextFireAt: Date
        createdAt: Date
        updatedAt: Date
      }>(
        client,
        `
          SELECT
            id,
            workflow_name AS "workflowName",
            cron_expression AS "cronExpression",
            payload,
            active,
            next_fire_at AS "nextFireAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM workflow_schedules
          WHERE active = TRUE
            AND next_fire_at <= now()
          ORDER BY next_fire_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        `,
        [args.limit]
      )
      const now = new Date()
      const fired: WorkflowScheduleRecord[] = []

      for (const row of scheduleRows) {
        const schedule = mapSchedule(row)
        const nextFireAt = args.getNextFireAt({ schedule, now })

        await queryRows(
          client,
          `
            UPDATE workflow_schedules
            SET
              next_fire_at = $2,
              updated_at = now()
            WHERE id = $1
          `,
          [schedule.id, nextFireAt]
        )
        fired.push(schedule)
      }

      return fired
    })

  const executeTransactionalTask = async (args: {
    run: WorkflowRunRecord
    stepKey: string
    workerId: string
    nextStepKey?: string
    retryPolicy?: RetryPolicy
    timeoutMs?: number
    resolveRetryAvailableAt: (input: {
      attempt: number
      retryPolicy: RetryPolicy
    }) => Date
    getErrorTag: (error: unknown) => string | null
    asErrorPayload: (error: unknown) => JsonObject
    mergeContext: (left: JsonObject, right?: JsonObject) => JsonObject
    runTask: (
      context: StepExecutionContext
    ) => Promise<TaskStepResult> | TaskStepResult
  }) => {
    const outcome = await withTransaction(db, async (client) => {
      const [lockedRunRow] = await queryRows<IRunRow>(
        client,
        `
          SELECT
            id,
            parent_run_id AS "parentRunId",
            parent_step_key AS "parentStepKey",
            definition_name AS "definitionName",
            definition_version AS "definitionVersion",
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
          WHERE id = $1
          FOR UPDATE
        `,
        [args.run.id]
      )

      if (!lockedRunRow) {
        return { outcome: "lost_lease" as const, run: null }
      }

      const lockedRun = mapRun(lockedRunRow)

      if (
        lockedRun.currentStepKey !== args.stepKey ||
        lockedRun.leaseOwner !== args.workerId ||
        lockedRun.leaseExpiresAt === null ||
        lockedRun.leaseExpiresAt.getTime() < Date.now()
      ) {
        return { outcome: "lost_lease" as const, run: null }
      }

      const attempt = await insertAttempt(client, {
        runId: args.run.id,
        stepKey: args.stepKey,
        input: {
          workflow: lockedRun.definitionName,
          step: args.stepKey,
          input: lockedRun.input,
          context: lockedRun.context,
        },
      })
      const now = new Date()
      const context: StepExecutionContext = {
        run: lockedRun,
        input: lockedRun.input,
        context: lockedRun.context,
        now,
        attempt: attempt.attempt,
        idempotencyKey: `${lockedRun.id}:${args.stepKey}`,
        heartbeat: async () => false,
        db: {
          query: async <T extends object>(
            text: string,
            values: readonly unknown[] = []
          ) => {
            const result = await client.query<T>(text, [...values])
            return {
              rows: result.rows as T[],
            }
          },
        },
        outbox: {
          enqueue: async (input) => {
            await enqueueOutbox({
              runId: lockedRun.id,
              topic: input.topic,
              payload: input.payload,
              client,
              ...(input.availableAt === undefined
                ? {}
                : { availableAt: input.availableAt }),
            })
          },
        },
        transactional: true,
      }

      await client.query("SAVEPOINT hippo_step_body")

      try {
        const result = await withPromiseTimeout(
          Promise.resolve(args.runTask(context)),
          args.timeoutMs,
          `Task step "${args.stepKey}" in workflow "${lockedRun.definitionName}"`
        )
        const nextStepKey = result.transition ?? args.nextStepKey

        if (!nextStepKey) {
          throw new Error(
            `Task step "${args.stepKey}" in workflow "${lockedRun.definitionName}" did not resolve a next step`
          )
        }

        const [updatedRow] = await queryRows<IRunRow>(
          client,
          `
            WITH updated_run AS (
              UPDATE workflow_runs
              SET
                status = 'queued',
                current_step_key = $4,
                context = $5,
                result = NULL,
                error = NULL,
                lease_owner = NULL,
                lease_expires_at = NULL,
                available_at = now(),
                updated_at = now()
              WHERE id = $1
                AND current_step_key = $2
                AND lease_owner = $3
                AND lease_expires_at >= now()
              RETURNING
                id,
                parent_run_id AS "parentRunId",
                parent_step_key AS "parentStepKey",
                definition_name AS "definitionName",
                definition_version AS "definitionVersion",
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
                output = $6,
                error = NULL,
                completed_at = now(),
                updated_at = now()
              WHERE id = $7
                AND run_id IN (SELECT id FROM updated_run)
            ), inserted_event AS (
              INSERT INTO workflow_events (run_id, step_key, event_type, payload)
              SELECT id, $2, 'step.completed', jsonb_build_object('nextStepKey', $4)
              FROM updated_run
            )
            SELECT * FROM updated_run
          `,
          [
            lockedRun.id,
            args.stepKey,
            args.workerId,
            nextStepKey,
            args.mergeContext(lockedRun.context, result.patch),
            result.output ?? null,
            attempt.id,
          ]
        )

        if (!updatedRow) {
          return { outcome: "lost_lease" as const, run: null }
        }

        await client.query("RELEASE SAVEPOINT hippo_step_body")
        return {
          outcome: "completed" as const,
          run: mapRun(updatedRow),
        }
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT hippo_step_body")
        await client.query("RELEASE SAVEPOINT hippo_step_body")
        const retryPolicy = args.retryPolicy
        const errorTag = args.getErrorTag(error)
        const isNonRetryable =
          errorTag !== null &&
          retryPolicy?.nonRetryableErrorTags?.includes(errorTag) === true
        const canRetry =
          retryPolicy !== undefined &&
          !isNonRetryable &&
          attempt.attempt < retryPolicy.maxAttempts
        const errorPayload = args.asErrorPayload(error)

        if (canRetry) {
          const availableAt = args.resolveRetryAvailableAt({
            attempt: attempt.attempt,
            retryPolicy,
          })
          const [updatedRow] = await queryRows<IRunRow>(
            client,
            `
              WITH updated_run AS (
                UPDATE workflow_runs
                SET
                  status = 'queued',
                  current_step_key = $2,
                  error = $4,
                  lease_owner = NULL,
                  lease_expires_at = NULL,
                  available_at = $5,
                  updated_at = now(),
                  completed_at = NULL
                WHERE id = $1
                  AND current_step_key = $2
                  AND lease_owner = $3
                  AND lease_expires_at >= now()
                RETURNING
                  id,
                  parent_run_id AS "parentRunId",
                  parent_step_key AS "parentStepKey",
                  definition_name AS "definitionName",
                  definition_version AS "definitionVersion",
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
                  error = $4,
                  completed_at = now(),
                  updated_at = now()
                WHERE id = $6
                  AND run_id IN (SELECT id FROM updated_run)
              ), inserted_event AS (
                INSERT INTO workflow_events (run_id, step_key, event_type, payload)
                SELECT id, $2, 'step.retry_scheduled',
                  jsonb_build_object('availableAt', to_jsonb($5))
                FROM updated_run
              )
              SELECT * FROM updated_run
            `,
            [
              lockedRun.id,
              args.stepKey,
              args.workerId,
              errorPayload,
              availableAt,
              attempt.id,
            ]
          )

          if (!updatedRow) {
            return { outcome: "lost_lease" as const, run: null }
          }

          return {
            outcome: "retry_scheduled" as const,
            run: mapRun(updatedRow),
          }
        }

        const [updatedRow] = await queryRows<IRunRow>(
          client,
          `
            WITH updated_run AS (
              UPDATE workflow_runs
              SET
                status = 'failed',
                error = $4,
                lease_owner = NULL,
                lease_expires_at = NULL,
                available_at = now(),
                updated_at = now(),
                completed_at = now()
              WHERE id = $1
                AND current_step_key = $2
                AND lease_owner = $3
                AND lease_expires_at >= now()
              RETURNING
                id,
                parent_run_id AS "parentRunId",
                parent_step_key AS "parentStepKey",
                definition_name AS "definitionName",
                definition_version AS "definitionVersion",
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
                error = $4,
                completed_at = now(),
                updated_at = now()
              WHERE id = $5
                AND run_id IN (SELECT id FROM updated_run)
            ), inserted_event AS (
              INSERT INTO workflow_events (run_id, step_key, event_type, payload)
              SELECT id, $2, 'step.failed', $4
              FROM updated_run
            )
            SELECT * FROM updated_run
          `,
          [lockedRun.id, args.stepKey, args.workerId, errorPayload, attempt.id]
        )

        if (!updatedRow) {
          return { outcome: "lost_lease" as const, run: null }
        }

        return {
          outcome: "failed" as const,
          run: mapRun(updatedRow),
        }
      }
    })
    if (outcome.run) {
      await notifyRunEvent(outcome.run.id)

      if (outcome.outcome === "completed") {
        await notifyRunnable()
      }
    }

    return outcome
  }

  const cancelRun = async (args: {
    runId: string
    reason?: string
  }) => {
    const [row] = await cancelRunQuery.run(
      {
        runId: args.runId,
        eventType: "run.canceled",
        eventPayload: args.reason ? { reason: args.reason } : {},
      },
      db
    )

    if (!row) {
      return null
    }

    const run = mapRun(row)
    await notifyRunnable()
    await notifyRunEvent(run.id)
    return run
  }

  const retryRun = async (runId: string) => {
    const [row] = await retryRunQuery.run(
      {
        runId,
        eventType: "run.retried",
        eventPayload: {},
      },
      db
    )

    if (!row) {
      return null
    }

    const run = mapRun(row)
    await notifyRunnable()
    return run
  }

  const recoverExpiredLeases = async (args: { limit: number }) => {
    const [row] = await recoverExpiredLeasesQuery.run(args, db)
    const reclaimed = requireRow(
      row,
      "Failed to recover expired leases"
    ).reclaimedCount

    if (reclaimed > 0) {
      await notifyRunnable()
    }

    return reclaimed
  }

  return {
    advanceTaskStep,
    beginStepAttempt,
    cancelRun,
    cancelRunAtBoundary,
    claimNextRunnableRun,
    claimOutboxMessages,
    completeRun,
    countOpenWaits,
    createSchedule,
    createSignal,
    consumeSignal,
    enqueueOutbox,
    extendLease,
    executeTransactionalTask,
    expireOpenWaits,
    failRun,
    fireDueSchedules,
    getChildRun,
    getRun,
    getRunAttempts,
    getRunEvents,
    listChildRuns,
    openWait,
    ping,
    listActiveRuns,
    listFailedRuns,
    listSchedules,
    listStuckRuns,
    markOutboxDelivered,
    queryStepDatabase,
    recoverExpiredLeases,
    requestCancelRun,
    resumeWait,
    consumeSignalAndResumeWait,
    retryRun,
    scheduleRetry,
    scheduleSleep,
    startRun,
    wakeParentForChild,
  }
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>
