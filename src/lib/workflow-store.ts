import type { PoolClient } from "pg"

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
  WorkflowCancelMode,
  SignalRecord,
  StepAttemptStatus,
  WorkflowEventRecord,
  WorkflowRunRecord,
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

export class LostLeaseError extends Error {}

export const createWorkflowStore = (db: Database) => {
  const startRun = async (args: {
    parentRunId?: string | null
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

    return mapRun(row)
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

    return mapRun(row)
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

    return mapRun(row)
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

    return mapRun(row)
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

    return mapRun(row)
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

    return mapRun(row)
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

      return updatedRow
        ? { status: "resumed" as const, run: mapRun(updatedRow) }
        : { status: "duplicate" as const, run }
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
    return row ? row.runId : null
  }

  const consumeSignal = async (args: {
    runId: string
    signalName: string
  }) => {
    const [row] = await consumeSignalQuery.run(args, db)
    return row ? mapSignal(row) : null
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

    return row ? mapRun(row) : null
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

    return row ? mapRun(row) : null
  }

  const recoverExpiredLeases = async (args: { limit: number }) => {
    const [row] = await recoverExpiredLeasesQuery.run(args, db)
    return requireRow(row, "Failed to recover expired leases").reclaimedCount
  }

  return {
    advanceTaskStep,
    beginStepAttempt,
    cancelRun,
    claimNextRunnableRun,
    completeRun,
    countOpenWaits,
    createSignal,
    consumeSignal,
    extendLease,
    expireOpenWaits,
    failRun,
    getRun,
    getRunAttempts,
    getRunEvents,
    openWait,
    ping,
    listActiveRuns,
    listFailedRuns,
    listStuckRuns,
    recoverExpiredLeases,
    resumeWait,
    retryRun,
    scheduleRetry,
    scheduleSleep,
    startRun,
  }
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>
