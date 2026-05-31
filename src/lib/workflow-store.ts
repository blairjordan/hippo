import type { PoolClient } from "pg"

import {
  advanceTaskStepQuery,
  claimNextRunnableRunQuery,
  completeRunQuery,
  completeWaitResumeQuery,
  countOpenWaitsQuery,
  failRunQuery,
  getLastStepAttemptQuery,
  getOpenWaitForUpdateQuery,
  getRunByIdForUpdateQuery,
  getRunByIdQuery,
  getRunEventsQuery,
  insertEventQuery,
  insertRunQuery,
  insertStepAttemptQuery,
  openWaitQuery,
  pingQuery,
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
  StepAttemptStatus,
  WaitStepResumeResult,
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
  status: row.status as WorkflowRunStatus,
  input: assertJsonObject(row.input, "Run input must be a JSON object"),
  context: assertJsonObject(row.context, "Run context must be a JSON object"),
  result: row.result,
  error: row.error,
})

const mapAttempt = (row: IAttemptRow): WorkflowStepAttemptRecord => ({
  ...row,
  status: row.status as StepAttemptStatus,
  input: assertJsonObject(row.input, "Attempt input must be a JSON object"),
  output: row.output,
  error: row.error,
})

const mapWait = (row: IWaitRow): WorkflowWaitRecord => ({
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
        return null
      }

      const wait = mapWait(waitRow)
      const [runRow] = await getRunByIdForUpdateQuery.run(
        { runId: wait.runId },
        client
      )
      const run = mapRun(requireRow(runRow, "Failed to load waiting run"))

      if (run.status !== "waiting" || run.currentStepKey !== wait.stepKey) {
        return null
      }

      const resumed = await args.resume(run, wait)

      const [updatedRow] = await completeWaitResumeQuery.run(
        {
          waitId: wait.id,
          runId: run.id,
          stepKey: wait.stepKey,
          nextStepKey: resumed.nextStepKey,
          context: resumed.context,
          output: resumed.output,
          eventType: "wait.resumed",
          eventPayload: { nextStepKey: resumed.nextStepKey },
        },
        client
      )

      return updatedRow ? mapRun(updatedRow) : null
    })

  const countOpenWaits = async () => {
    const [row] = await countOpenWaitsQuery.run(undefined, db)
    return requireRow(row, "Failed to count open waits").waitCount
  }

  return {
    advanceTaskStep,
    beginStepAttempt,
    claimNextRunnableRun,
    completeRun,
    countOpenWaits,
    failRun,
    getRun,
    getRunEvents,
    openWait,
    ping,
    resumeWait,
    scheduleRetry,
    scheduleSleep,
    startRun,
  }
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>
