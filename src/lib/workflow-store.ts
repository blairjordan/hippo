import type { PoolClient } from "pg"

import {
  advanceTaskStep as advanceTaskStepQuery,
  cancelRun as cancelRunQuery,
  cancelRunAtBoundary as cancelRunAtBoundaryQuery,
  claimDueSchedules as claimDueSchedulesQuery,
  claimNextRunnableRun as claimNextRunnableRunQuery,
  claimOutboxMessages as claimOutboxMessagesQuery,
  completeTransactionalTask as completeTransactionalTaskQuery,
  completeRun as completeRunQuery,
  continueAsNewCompleteAttempt as continueAsNewCompleteAttemptQuery,
  continueAsNewCompleteSource as continueAsNewCompleteSourceQuery,
  continueAsNewInsertRun as continueAsNewInsertRunQuery,
  continueAsNewSetResult as continueAsNewSetResultQuery,
  completeStandaloneStepAttempt as completeStandaloneStepAttemptQuery,
  completeWaitResume as completeWaitResumeQuery,
  consumeSignal as consumeSignalQuery,
  countOpenWaits as countOpenWaitsQuery,
  createSchedule as createScheduleQuery,
  createSignal as createSignalQuery,
  extendLease as extendLeaseQuery,
  expireOpenWaits as expireOpenWaitsQuery,
  failTransactionalTask as failTransactionalTaskQuery,
  failRun as failRunQuery,
  failStandaloneStepAttempt as failStandaloneStepAttemptQuery,
  getChildRun as getChildRunQuery,
  getLastStepAttempt as getLastStepAttemptQuery,
  getLastStepSequence as getLastStepSequenceQuery,
  getOpenWaitForUpdate as getOpenWaitForUpdateQuery,
  getRunByDefinitionAndIdempotencyKey as getRunByDefinitionAndIdempotencyKeyQuery,
  getRunById as getRunByIdQuery,
  getRunByIdForUpdate as getRunByIdForUpdateQuery,
  getRunAttempts as getRunAttemptsQuery,
  getRunEvents as getRunEventsQuery,
  getStepAttemptByIdForRun as getStepAttemptByIdForRunQuery,
  insertEvent as insertEventQuery,
  insertBranchedRun as insertBranchedRunQuery,
  insertOutbox as insertOutboxQuery,
  insertRun as insertRunQuery,
  insertStepAttempt as insertStepAttemptQuery,
  listActiveRuns as listActiveRunsQuery,
  listChildRuns as listChildRunsQuery,
  listFailedRuns as listFailedRunsQuery,
  listRunLineage as listRunLineageQuery,
  listRuns as listRunsQuery,
  listSchedules as listSchedulesQuery,
  listStuckRuns as listStuckRunsQuery,
  markOutboxDelivered as markOutboxDeliveredQuery,
  markRunCompensationFailed as markRunCompensationFailedQuery,
  markRunSuperseded as markRunSupersededQuery,
  openWait as openWaitQuery,
  ping as pingQuery,
  recoverExpiredLeases as recoverExpiredLeasesQuery,
  requestCancelRun as requestCancelRunQuery,
  rescheduleAfterFire as rescheduleAfterFireQuery,
  retryTransactionalTask as retryTransactionalTaskQuery,
  retryRun as retryRunQuery,
  scheduleRetry as scheduleRetryQuery,
  scheduleSleep as scheduleSleepQuery,
  startRunIdempotent as startRunIdempotentQuery,
  wakeParentForChild as wakeParentForChildQuery,
} from "../queries/workflow-store.queries.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  RetryPolicy,
  StepExecutionContext,
  TaskStepResult,
  WorkflowCancelMode,
  WorkflowOutboxRecord,
  SignalRecord,
  StepAttemptKind,
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
import {
  createHippoTracer,
  createTraceAttributes,
  getActiveTraceContext,
  type HippoTracer,
  type TraceAttributes,
} from "./tracing.js"

type IRunRow = {
  id: string
  parentRunId?: string | null
  parentStepKey?: string | null
  continuedFromRunId?: string | null
  branchedFromRunId?: string | null
  branchedFromAttemptRunId?: string | null
  branchedFromAttemptId?: string | null
  supersededByRunId?: string | null
  definitionName: string
  definitionVersion: number
  taskQueue?: string
  priority?: number
  status: string
  currentStepKey: string | null
  input: JsonValue
  context: JsonValue
  result: JsonValue | null
  error: JsonValue | null
  leaseOwner: string | null
  leaseExpiresAt: Date | null
  cancelRequestedAt?: Date | null
  cancelMode?: string | null
  availableAt: Date
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  traceContext?: string | null
}

type IAttemptRow = {
  id: string
  runId: string
  stepKey: string
  kind: StepAttemptKind
  stepSeq?: number
  attempt: number
  status: string
  contextBefore?: JsonValue
  input: JsonValue
  output: JsonValue | null
  error: JsonValue | null
  startedAt: Date
  lastHeartbeatAt?: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  traceContext?: string | null
}

type IWaitRow = {
  id: string
  runId: string
  stepKey: string
  correlationKey: string
  status: "open" | "resumed" | "expired" | "canceled"
  payload: JsonValue | null
  resumePayload: JsonValue | null
  resumeOutput: JsonValue | null
  expiresAt?: Date | null
  createdAt: Date
  updatedAt: Date
  resumedAt: Date | null
}

type IEventRow = {
  id: number | string
  runId: string
  stepKey: string | null
  eventType: string
  payload: JsonValue
  createdAt: Date
}

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
  continuedFromRunId: row.continuedFromRunId ?? null,
  branchedFromRunId: row.branchedFromRunId ?? null,
  branchedFromAttemptRunId: row.branchedFromAttemptRunId ?? null,
  branchedFromAttemptId: row.branchedFromAttemptId ?? null,
  supersededByRunId: row.supersededByRunId ?? null,
  taskQueue: row.taskQueue ?? "default",
  priority: row.priority ?? 0,
  status: row.status as WorkflowRunStatus,
  input: assertJsonObject(row.input, "Run input must be a JSON object"),
  context: assertJsonObject(row.context, "Run context must be a JSON object"),
  result: row.result,
  error: row.error,
  cancelRequestedAt: row.cancelRequestedAt ?? null,
  cancelMode: (row.cancelMode as WorkflowCancelMode | null | undefined) ?? null,
  traceContext: row.traceContext ?? null,
})

const mapAttempt = (row: IAttemptRow): WorkflowStepAttemptRecord => ({
  ...row,
  kind: row.kind as StepAttemptKind,
  stepSeq: row.stepSeq ?? 0,
  status: row.status as StepAttemptStatus,
  contextBefore: assertJsonObject(
    row.contextBefore ?? {},
    "Attempt contextBefore must be a JSON object"
  ),
  input: assertJsonObject(row.input, "Attempt input must be a JSON object"),
  output: row.output,
  error: row.error,
  lastHeartbeatAt: row.lastHeartbeatAt ?? null,
  traceContext: row.traceContext ?? null,
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
  id: Number(row.id),
  payload: assertJsonObject(row.payload, "Event payload must be a JSON object"),
})

const insertAttempt = async (
  client: PoolClient,
  args: {
    runId: string
    stepKey: string
    kind: StepAttemptKind
    input: JsonObject
  }
) => {
  const [countRow] = await getLastStepAttemptQuery.run(
    { runId: args.runId, stepKey: args.stepKey, kind: args.kind },
    client
  )
  const [runRow] = await getRunByIdForUpdateQuery.run({ runId: args.runId }, client)
  const run = mapRun(requireRow(runRow, `Run "${args.runId}" not found`))
  const [stepSeqRow] = await getLastStepSequenceQuery.run(
    { runId: args.runId },
    client
  )
  const attempt = (countRow?.lastAttempt ?? 0) + 1
  const [row] = await insertStepAttemptQuery.run(
    {
      runId: args.runId,
      stepKey: args.stepKey,
      kind: args.kind,
      stepSeq: (stepSeqRow?.lastStepSeq ?? 0) + 1,
      attempt,
      contextBefore: run.context,
      input: args.input,
      traceContext: getActiveTraceContext() ?? null,
    },
    client
  )

  return mapAttempt(requireRow(row, "Failed to insert step attempt"))
}

const mapSchedule = (row: {
  id: string
  workflowName: string
  cronExpression: string
  payload: JsonValue
  taskQueue?: string
  priority?: number
  active: boolean
  nextFireAt: Date
  createdAt: Date
  updatedAt: Date
}): WorkflowScheduleRecord => ({
  ...row,
  taskQueue: row.taskQueue ?? "default",
  priority: row.priority ?? 0,
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

const terminalRunStatuses = new Set<WorkflowRunStatus>([
  "completed",
  "failed",
  "compensation_failed",
  "canceled",
])

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
    tracer?: HippoTracer
  } = {}
) => {
  const tracer = options.tracer ?? createHippoTracer()
  const notifyRunnable = async () => {
    await options.notifyRunnable?.()
  }

  const notifyRunEvent = async (runId: string) => {
    await options.notifyRunEvent?.(runId)
  }

  const withStoreSpan = <T>(
    input: {
      name: string
      attributes?: TraceAttributes
    },
    run: () => Promise<T>
  ) =>
    tracer.withSpan(
      {
        name: `hippo.store.${input.name}`,
        ...(input.attributes === undefined
          ? {}
          : { attributes: input.attributes }),
      },
      run
    )

  const startRun = async (args: {
    parentRunId?: string | null
    parentStepKey?: string | null
    definitionName: string
    definitionVersion: number
    taskQueue: string
    priority: number
    input: JsonObject
    currentStepKey: string
    idempotencyKey?: string | null
    traceContext?: string | null
  }) =>
    withStoreSpan(
      {
        name: "start_run",
        attributes: createTraceAttributes({
          operation: "store.start_run",
          workflowName: args.definitionName,
          workflowVersion: args.definitionVersion,
          stepKey: args.currentStepKey,
          taskQueue: args.taskQueue,
        }),
      },
      () =>
        withTransaction(db, async (client) => {
          const traceContext = args.traceContext ?? getActiveTraceContext() ?? null
          const params = {
            ...args,
            traceContext,
          }

          if (args.idempotencyKey) {
            const [idempotentRow] = await startRunIdempotentQuery.run(params, client)

            if (idempotentRow) {
              const run = mapRun(idempotentRow as unknown as IRunRow)

              if (idempotentRow.inserted) {
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
              }

              return run
            }

            const [existingRow] =
              await getRunByDefinitionAndIdempotencyKeyQuery.run(
                {
                  definitionName: args.definitionName,
                  idempotencyKey: args.idempotencyKey,
                },
                client
              )

            if (existingRow) {
              return mapRun(existingRow)
            }
          }

          const [runRow] = await insertRunQuery.run(params, client)
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
    )

  const getRun = async (runId: string) => {
    return withStoreSpan(
      {
        name: "get_run",
        attributes: createTraceAttributes({
          operation: "store.get_run",
          runId,
        }),
      },
      async () => {
        const [row] = await getRunByIdQuery.run({ runId }, db)
        return row ? mapRun(row) : null
      }
    )
  }

  const getRunEvents = async (runId: string) => {
    return withStoreSpan(
      {
        name: "get_run_events",
        attributes: createTraceAttributes({
          operation: "store.get_run_events",
          runId,
        }),
      },
      async () => {
        const rows = await getRunEventsQuery.run({ runId }, db)
        return rows.map(mapEvent)
      }
    )
  }

  const getRunAttempts = async (runId: string) => {
    return withStoreSpan(
      {
        name: "get_run_attempts",
        attributes: createTraceAttributes({
          operation: "store.get_run_attempts",
          runId,
        }),
      },
      async () => {
        const rows = await getRunAttemptsQuery.run({ runId }, db)
        return rows.map(mapAttempt)
      }
    )
  }

  const ping = async () => {
    const [row] = await pingQuery.run(undefined, db)
    return requireRow(row, "Database ping failed").ok === 1
  }

  const claimNextRunnableRun = async (args: {
    workerId: string
    leaseMs: number
    taskQueues: string[]
  }) =>
    withStoreSpan(
      {
        name: "claim_next_runnable_run",
        attributes: {
          ...createTraceAttributes({
            operation: "store.claim_next_runnable_run",
            workerId: args.workerId,
          }),
          "workflow.task_queue_count": args.taskQueues.length,
        },
      },
      () =>
        withTransaction(db, async (client) => {
          const [row] = await claimNextRunnableRunQuery.run(args, client)
          return row ? mapRun(row) : null
        })
    )

  const beginStepAttempt = async (args: {
    runId: string
    stepKey: string
    kind?: StepAttemptKind
    input: JsonObject
  }) =>
    withStoreSpan(
      {
        name: "begin_step_attempt",
        attributes: createTraceAttributes({
          operation: "store.begin_step_attempt",
          runId: args.runId,
          stepKey: args.stepKey,
          stepKind: args.kind ?? "forward",
        }),
      },
      () =>
        withTransaction(db, (client) =>
          insertAttempt(client, {
            ...args,
            kind: args.kind ?? "forward",
          })
        )
    )

  const completeStepAttempt = async (args: {
    runId: string
    stepKey: string
    attemptId: string
    output: JsonValue | null
  }) => {
    const [row] = await completeStandaloneStepAttemptQuery.run(
      {
        runId: args.runId,
        attemptId: args.attemptId,
        output: args.output,
      },
      db
    )

    if (!row) {
      throw new Error(`Failed to complete step attempt "${args.attemptId}"`)
    }

    await insertEventQuery.run(
      {
        runId: args.runId,
        stepKey: args.stepKey,
        eventType: "compensation.completed",
        payload: {},
      },
      db
    )
    await notifyRunEvent(args.runId)
    return mapAttempt(row)
  }

  const failStepAttempt = async (args: {
    runId: string
    stepKey: string
    attemptId: string
    error: JsonObject
  }) => {
    const [row] = await failStandaloneStepAttemptQuery.run(
      {
        runId: args.runId,
        attemptId: args.attemptId,
        error: args.error,
      },
      db
    )

    if (!row) {
      throw new Error(`Failed to fail step attempt "${args.attemptId}"`)
    }

    await insertEventQuery.run(
      {
        runId: args.runId,
        stepKey: args.stepKey,
        eventType: "compensation.failed",
        payload: args.error,
      },
      db
    )
    await notifyRunEvent(args.runId)
    return mapAttempt(row)
  }

  const completeRun = async (args: {
    runId: string
    stepKey: string
    workerId: string
    context: JsonObject
    result: JsonValue | null
  }) =>
    withStoreSpan(
      {
        name: "complete_run",
        attributes: createTraceAttributes({
          operation: "store.complete_run",
          runId: args.runId,
          stepKey: args.stepKey,
          workerId: args.workerId,
        }),
      },
      async () => {
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
    )

  const continueAsNew = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    context: JsonObject
    currentStepKey: string
    input: JsonObject
    taskQueue: string
    priority: number
  }) =>
    withStoreSpan(
      {
        name: "continue_as_new",
        attributes: createTraceAttributes({
          operation: "store.continue_as_new",
          runId: args.runId,
          stepKey: args.stepKey,
          workerId: args.workerId,
          taskQueue: args.taskQueue,
        }),
      },
      () =>
        withTransaction(db, async (client) => {
          const [completedRow] = await continueAsNewCompleteSourceQuery.run(
            {
              runId: args.runId,
              stepKey: args.stepKey,
              workerId: args.workerId,
              context: args.context,
            },
            client
          )

          if (!completedRow) {
            throw new LostLeaseError("Failed to continue run under active lease")
          }

          const completedRun = mapRun(completedRow)

          const [nextRunRow] = await continueAsNewInsertRunQuery.run(
            {
              continuedFromRunId: completedRun.id,
              definitionName: completedRun.definitionName,
              definitionVersion: completedRun.definitionVersion,
              taskQueue: args.taskQueue,
              priority: args.priority,
              currentStepKey: args.currentStepKey,
              input: args.input,
              traceContext: getActiveTraceContext() ?? null,
            },
            client
          )

          const nextRun = mapRun(
            requireRow(nextRunRow, "Failed to insert continued run")
          )

          await continueAsNewSetResultQuery.run(
            {
              runId: completedRun.id,
              continuedRunId: nextRun.id,
            },
            client
          )

          await continueAsNewCompleteAttemptQuery.run(
            {
              attemptId: args.attemptId,
              continuedRunId: nextRun.id,
              runId: args.runId,
            },
            client
          )

          await insertEventQuery.run(
            {
              runId: completedRun.id,
              stepKey: args.stepKey,
              eventType: "run.continued_as_new",
              payload: {
                continuedRunId: nextRun.id,
              },
            },
            client
          )

          await insertEventQuery.run(
            {
              runId: nextRun.id,
              stepKey: nextRun.currentStepKey,
              eventType: "run.started",
              payload: {
                continuedFromRunId: completedRun.id,
              },
            },
            client
          )

          await notifyRunnable()
          await notifyRunEvent(completedRun.id)
          await notifyRunEvent(nextRun.id)
          return nextRun
        })
    )

  const advanceTaskStep = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    nextStepKey: string
    context: JsonObject
    output: JsonValue | null
  }) =>
    withStoreSpan(
      {
        name: "advance_task_step",
        attributes: {
          ...createTraceAttributes({
            operation: "store.advance_task_step",
            runId: args.runId,
            stepKey: args.stepKey,
            workerId: args.workerId,
          }),
          "workflow.next_step.key": args.nextStepKey,
        },
      },
      async () => {
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
    )

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
  }) =>
    withStoreSpan(
      {
        name: "open_wait",
        attributes: createTraceAttributes({
          operation: "store.open_wait",
          runId: args.runId,
          stepKey: args.stepKey,
          workerId: args.workerId,
        }),
      },
      async () => {
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
    )

  const scheduleRetry = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    availableAt: Date
    error: JsonObject
  }) =>
    withStoreSpan(
      {
        name: "schedule_retry",
        attributes: createTraceAttributes({
          operation: "store.schedule_retry",
          runId: args.runId,
          stepKey: args.stepKey,
          workerId: args.workerId,
        }),
      },
      async () => {
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
    )

  const failRun = async (args: {
    runId: string
    stepKey: string
    workerId: string
    attemptId: string
    error: JsonObject
  }) =>
    withStoreSpan(
      {
        name: "fail_run",
        attributes: createTraceAttributes({
          operation: "store.fail_run",
          runId: args.runId,
          stepKey: args.stepKey,
          workerId: args.workerId,
        }),
      },
      async () => {
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
    )

  const markRunCompensationFailed = async (args: {
    runId: string
    stepKey: string
    error: JsonObject
  }) => {
    const [row] = await markRunCompensationFailedQuery.run(
      {
        runId: args.runId,
        stepKey: args.stepKey,
        error: args.error,
        eventType: "run.compensation_failed",
        eventPayload: args.error,
      },
      db
    )

    if (!row) {
      throw new Error(
        `Failed to mark run "${args.runId}" compensation failure state`
      )
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
    withStoreSpan(
      {
        name: "resume_wait",
        attributes: {
          "hippo.operation": "store.resume_wait",
          "workflow.wait.correlation_key": args.correlationKey,
        },
      },
      () =>
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
    )

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
    withStoreSpan(
      {
        name: "consume_signal_and_resume_wait",
        attributes: {
          "hippo.operation": "store.consume_signal_and_resume_wait",
          "workflow.wait.correlation_key": args.correlationKey,
          "workflow.signal.name": args.signalName,
        },
      },
      () =>
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
    )

  const countOpenWaits = async () => {
    const [row] = await countOpenWaitsQuery.run(undefined, db)
    return requireRow(row, "Failed to count open waits").waitCount ?? 0
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
    return withStoreSpan(
      {
        name: "expire_open_waits",
        attributes: {
          "hippo.operation": "store.expire_open_waits",
          "workflow.recovery.limit": args.limit,
        },
      },
      async () => {
        const [row] = await expireOpenWaitsQuery.run(args, db)
        return requireRow(row, "Failed to expire open waits").expiredCount ?? 0
      }
    )
  }

  const createSignal = async (args: {
    runId: string
    signalName: string
    payload: JsonValue | null
  }) =>
    withStoreSpan(
      {
        name: "create_signal",
        attributes: {
          ...createTraceAttributes({
            operation: "store.create_signal",
            runId: args.runId,
          }),
          "workflow.signal.name": args.signalName,
        },
      },
      async () => {
        const [row] = await createSignalQuery.run(args, db)

        if (row) {
          await notifyRunnable()
          return row.runId
        }

        return null
      }
    )

  const consumeSignal = async (args: {
    runId: string
    signalName: string
  }) =>
    withStoreSpan(
      {
        name: "consume_signal",
        attributes: {
          ...createTraceAttributes({
            operation: "store.consume_signal",
            runId: args.runId,
          }),
          "workflow.signal.name": args.signalName,
        },
      },
      async () => {
        const [row] = await consumeSignalQuery.run(args, db)
        return row ? mapSignal(row) : null
      }
    )

  const getChildRun = async (args: {
    parentRunId: string
    parentStepKey: string
  }) =>
    withStoreSpan(
      {
        name: "get_child_run",
        attributes: createTraceAttributes({
          operation: "store.get_child_run",
          runId: args.parentRunId,
          stepKey: args.parentStepKey,
        }),
      },
      async () => {
        const [row] = await getChildRunQuery.run(args, db)

        if (!row) {
          return null
        }

        const run = mapRun(row)
        await notifyRunnable()
        await notifyRunEvent(run.id)
        return run
      }
    )

  const listChildRuns = async (parentRunId: string) =>
    withStoreSpan(
      {
        name: "list_child_runs",
        attributes: createTraceAttributes({
          operation: "store.list_child_runs",
          runId: parentRunId,
        }),
      },
      async () => {
        const rows = await listChildRunsQuery.run({ parentRunId }, db)

        return rows.map(mapRun)
      }
    )

  const wakeParentForChild = async (childRun: WorkflowRunRecord) => {
    if (!childRun.parentRunId || !childRun.parentStepKey) {
      return false
    }

    const payload = {
      childRunId: childRun.id,
      childStatus: childRun.status,
    }
    const correlationKey = `child:${childRun.parentRunId}:${childRun.parentStepKey}`
    const [row] = await wakeParentForChildQuery.run(
      { correlationKey, payload },
      db
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
  }) =>
    withStoreSpan(
      {
        name: "request_cancel_run",
        attributes: createTraceAttributes({
          operation: "store.request_cancel_run",
          runId: args.runId,
        }),
      },
      async () => {
        const eventType =
          args.mode === "hard" ? "run.canceled" : "run.cancel_requested"
        const eventPayload = {
          mode: args.mode,
          ...(args.reason ? { reason: args.reason } : {}),
        }
        const [row] = await requestCancelRunQuery.run(
          {
            runId: args.runId,
            mode: args.mode,
            eventType,
            eventPayload,
          },
          db
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
    )

  const cancelRunAtBoundary = async (args: {
    runId: string
    stepKey: string
    workerId: string
    mode: WorkflowCancelMode
  }) => {
    const [row] = await cancelRunAtBoundaryQuery.run(args, db)

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

  const listRuns = async (args: {
    limit: number
    parentRunId?: string
    search?: string
    status?: WorkflowRunStatus
    taskQueue?: string
    workflowName?: string
  }) => {
    const rows = await listRunsQuery.run(
      {
        limit: args.limit,
        parentRunId: args.parentRunId,
        search: args.search,
        status: args.status,
        taskQueue: args.taskQueue,
        workflowName: args.workflowName,
      },
      db
    )

    return rows.map(mapRun)
  }

  const listRunsPaginated = async (args: {
    limit: number
    statuses?: WorkflowRunStatus[]
    workflowName?: string
    search?: string
    parentRunId?: string
    taskQueue?: string
    afterUpdatedAt?: Date
    afterId?: string
  }) => {
    const conditions: string[] = []
    const values: unknown[] = []
    const placeholder = () => `$${String(values.length)}`

    if (args.statuses && args.statuses.length > 0) {
      values.push(args.statuses)
      conditions.push(`status::text = ANY(${placeholder()}::text[])`)
    }

    if (args.workflowName) {
      values.push(args.workflowName)
      conditions.push(`definition_name = ${placeholder()}::text`)
    }

    if (args.search) {
      values.push(`%${args.search}%`)
      const search = `${placeholder()}::text`
      conditions.push(
        `(id::text ILIKE ${search} OR definition_name ILIKE ${search} OR COALESCE(current_step_key, '') ILIKE ${search})`
      )
    }

    if (args.parentRunId) {
      values.push(args.parentRunId)
      conditions.push(`parent_run_id = ${placeholder()}::uuid`)
    }

    if (args.taskQueue) {
      values.push(args.taskQueue)
      conditions.push(`task_queue = ${placeholder()}::text`)
    }

    if (args.afterUpdatedAt && args.afterId) {
      values.push(args.afterUpdatedAt)
      const ts = `${placeholder()}::timestamptz`
      values.push(args.afterId)
      const id = `${placeholder()}::uuid`
      conditions.push(`(updated_at, id) < (${ts}, ${id})`)
    }

    const safeLimit = Math.max(1, Math.min(500, Math.floor(args.limit)))

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const text = `
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
      ${where}
      ORDER BY updated_at DESC, id DESC
      LIMIT ${String(safeLimit)}
    `

    const result = await db.query<IRunRow>(text, values as unknown[] as never[])
    return result.rows.map(mapRun)
  }

  const listRunLineage = async (runId: string) => {
    const rows = await listRunLineageQuery.run({ runId }, db)
    return rows.flatMap((row) => {
      if (
        typeof row.id !== "string" ||
        typeof row.definitionName !== "string" ||
        typeof row.definitionVersion !== "number" ||
        typeof row.status !== "string" ||
        row.input === null ||
        row.context === null ||
        !(row.availableAt instanceof Date) ||
        !(row.createdAt instanceof Date) ||
        !(row.updatedAt instanceof Date)
      ) {
        return []
      }

      return [
        mapRun({
          id: row.id,
          parentRunId: row.parentRunId,
          parentStepKey: row.parentStepKey,
          continuedFromRunId: row.continuedFromRunId,
          branchedFromRunId: row.branchedFromRunId,
          branchedFromAttemptRunId: row.branchedFromAttemptRunId,
          branchedFromAttemptId: row.branchedFromAttemptId,
          supersededByRunId: row.supersededByRunId,
          definitionName: row.definitionName,
          definitionVersion: row.definitionVersion,
          status: row.status,
          currentStepKey: row.currentStepKey,
          input: row.input,
          context: row.context,
          result: row.result,
          error: row.error,
          leaseOwner: row.leaseOwner,
          leaseExpiresAt: row.leaseExpiresAt,
          cancelRequestedAt: row.cancelRequestedAt,
          cancelMode: row.cancelMode,
          availableAt: row.availableAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          completedAt: row.completedAt,
          ...(typeof row.taskQueue === "string"
            ? { taskQueue: row.taskQueue }
            : {}),
          ...(typeof row.priority === "number"
            ? { priority: row.priority }
            : {}),
        }),
      ]
    })
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
    await insertOutboxQuery.run(
      {
        runId: args.runId ?? null,
        topic: args.topic,
        payload: args.payload,
        availableAt: args.availableAt ?? null,
      },
      args.client ?? db
    )
  }

  const queryStepDatabase = async <
    T extends object = Record<string, unknown>,
  >(
    text: string,
    values: readonly unknown[] = []
  ) =>
    withStoreSpan(
      {
        name: "query_step_database",
        attributes: {
          "hippo.operation": "store.query_step_database",
        },
      },
      async () => {
        const result = await db.query<T>(text, [...values])
        return {
          rows: result.rows,
        }
      }
    )

  const claimOutboxMessages = async (limit: number) =>
    withStoreSpan(
      {
        name: "claim_outbox_messages",
        attributes: {
          "hippo.operation": "store.claim_outbox_messages",
          "workflow.outbox.limit": limit,
        },
      },
      () =>
        withTransaction(db, async (client) => {
          const rows = await claimOutboxMessagesQuery.run({ limit }, client)

          return rows.map(mapOutbox)
        })
    )

  const markOutboxDelivered = async (outboxId: string) => {
    return withStoreSpan(
      {
        name: "mark_outbox_delivered",
        attributes: {
          "hippo.operation": "store.mark_outbox_delivered",
          "workflow.outbox.id": outboxId,
        },
      },
      async () => {
        const rows = await markOutboxDeliveredQuery.run({ outboxId }, db)

        return rows.length > 0
      }
    )
  }

  const createSchedule = async (args: {
    workflowName: string
    cronExpression: string
    payload?: JsonObject
    taskQueue: string
    priority: number
    nextFireAt: Date
  }) =>
    withStoreSpan(
      {
        name: "create_schedule",
        attributes: {
          ...createTraceAttributes({
            operation: "store.create_schedule",
            workflowName: args.workflowName,
            taskQueue: args.taskQueue,
          }),
          "workflow.schedule.cron": args.cronExpression,
        },
      },
      async () => {
        const rows = await createScheduleQuery.run(
          {
            workflowName: args.workflowName,
            cronExpression: args.cronExpression,
            payload: args.payload ?? {},
            taskQueue: args.taskQueue,
            priority: args.priority,
            nextFireAt: args.nextFireAt,
          },
          db
        )

        return mapSchedule(requireRow(rows[0], "Failed to create schedule"))
      }
    )

  const listSchedules = async () => {
    const rows = await listSchedulesQuery.run(undefined, db)

    return rows.map(mapSchedule)
  }

  const fireDueSchedules = async (args: {
    limit: number
    getNextFireAt: (input: {
      schedule: WorkflowScheduleRecord
      now: Date
    }) => Date
  }) =>
    withStoreSpan(
      {
        name: "fire_due_schedules",
        attributes: {
          "hippo.operation": "store.fire_due_schedules",
          "workflow.schedule.limit": args.limit,
        },
      },
      () =>
        withTransaction(db, async (client) => {
          const scheduleRows = await claimDueSchedulesQuery.run(
            { limit: args.limit },
            client
          )
          const now = new Date()
          const fired: WorkflowScheduleRecord[] = []

          for (const row of scheduleRows) {
            const schedule = mapSchedule(row)
            const nextFireAt = args.getNextFireAt({ schedule, now })

            await rescheduleAfterFireQuery.run(
              {
                id: schedule.id,
                nextFireAt,
              },
              client
            )
            fired.push(schedule)
          }

          return fired
        })
    )

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
  }) =>
    withStoreSpan(
      {
        name: "execute_transactional_task",
        attributes: createTraceAttributes({
          operation: "store.execute_transactional_task",
          workflowName: args.run.definitionName,
          workflowVersion: args.run.definitionVersion,
          runId: args.run.id,
          stepKey: args.stepKey,
          stepKind: "task",
          taskQueue: args.run.taskQueue,
          workerId: args.workerId,
        }),
      },
      async () => {
        const outcome = await withTransaction(db, async (client) => {
          const [lockedRunRow] = await getRunByIdForUpdateQuery.run(
            { runId: args.run.id },
            client
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
            kind: "forward",
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
        const result = await tracer.withSpan(
          {
            name: "hippo.workflow.step.run_task",
            attributes: createTraceAttributes({
              operation: "workflow.step.run_task",
              workflowName: lockedRun.definitionName,
              workflowVersion: lockedRun.definitionVersion,
              runId: lockedRun.id,
              stepKey: args.stepKey,
              stepKind: "task",
              taskQueue: lockedRun.taskQueue,
              workerId: args.workerId,
            }),
          },
          () =>
            withPromiseTimeout(
              Promise.resolve(args.runTask(context)),
              args.timeoutMs,
              `Task step "${args.stepKey}" in workflow "${lockedRun.definitionName}"`
            )
        )
        const nextStepKey = result.transition ?? args.nextStepKey

        if (!nextStepKey) {
          throw new Error(
            `Task step "${args.stepKey}" in workflow "${lockedRun.definitionName}" did not resolve a next step`
          )
        }

        const [updatedRow] = await completeTransactionalTaskQuery.run(
          {
            runId: lockedRun.id,
            stepKey: args.stepKey,
            workerId: args.workerId,
            nextStepKey,
            context: args.mergeContext(lockedRun.context, result.patch),
            output: result.output ?? null,
            attemptId: attempt.id,
          },
          client
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
          const [updatedRow] = await retryTransactionalTaskQuery.run(
            {
              runId: lockedRun.id,
              stepKey: args.stepKey,
              workerId: args.workerId,
              error: errorPayload,
              availableAt,
              attemptId: attempt.id,
            },
            client
          )

          if (!updatedRow) {
            return { outcome: "lost_lease" as const, run: null }
          }

          return {
            outcome: "retry_scheduled" as const,
            run: mapRun(updatedRow),
          }
        }

        const [updatedRow] = await failTransactionalTaskQuery.run(
          {
            runId: lockedRun.id,
            stepKey: args.stepKey,
            workerId: args.workerId,
            error: errorPayload,
            attemptId: attempt.id,
          },
          client
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
    )

  const cancelRun = async (args: {
    runId: string
    reason?: string
  }) =>
    withStoreSpan(
      {
        name: "cancel_run",
        attributes: createTraceAttributes({
          operation: "store.cancel_run",
          runId: args.runId,
        }),
      },
      async () => {
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
    )

  const retryRun = async (runId: string) =>
    withStoreSpan(
      {
        name: "retry_run",
        attributes: createTraceAttributes({
          operation: "store.retry_run",
          runId,
        }),
      },
      async () => {
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
    )

  const branchRun = async (args: {
    runId: string
    attemptId: string
    mode: "rewind" | "fork"
  }) =>
    withStoreSpan(
      {
        name: "branch_run",
        attributes: createTraceAttributes({
          operation: args.mode === "rewind" ? "store.rewind_run" : "store.fork_run",
          runId: args.runId,
        }),
      },
      () =>
        withTransaction(db, async (client) => {
      const [sourceRunRow] = await getRunByIdForUpdateQuery.run(
        { runId: args.runId },
        client
      )

      if (!sourceRunRow) {
        return null
      }

      const sourceRun = mapRun(sourceRunRow)

      if (args.mode === "rewind" && sourceRun.supersededByRunId) {
        throw new Error(`Run "${args.runId}" has already been rewound`)
      }

      if (!terminalRunStatuses.has(sourceRun.status)) {
        if (args.mode === "rewind") {
          const cancelTree = async (runId: string) => {
            await requestCancelRunQuery.run(
              {
                runId,
                mode: "hard",
                eventType: "run.canceled",
                eventPayload: { reason: "Superseded by rewind" },
              },
              client
            )

            const childRows = await listChildRunsQuery.run({ parentRunId: runId }, client)
            for (const childRow of childRows) {
              await cancelTree(childRow.id)
            }
          }

          await cancelTree(sourceRun.id)
        } else {
          throw new Error(
            `Run "${args.runId}" must be terminal before ${args.mode}`
          )
        }
      }

      const [attemptRow] = await getStepAttemptByIdForRunQuery.run(
        {
          runId: args.runId,
          attemptId: args.attemptId,
        },
        client
      )

      if (!attemptRow) {
        throw new Error(
          `Attempt "${args.attemptId}" does not belong to run "${args.runId}"`
        )
      }

      const attempt = mapAttempt(attemptRow)

      if (attempt.kind !== "forward") {
        throw new Error("Only forward attempts can be rewound or forked")
      }

      const [nextRunRow] = await insertBranchedRunQuery.run(
        {
          branchedFromRunId: sourceRun.id,
          branchedFromAttemptRunId: attempt.runId,
          branchedFromAttemptId: attempt.id,
          definitionName: sourceRun.definitionName,
          definitionVersion: sourceRun.definitionVersion,
          taskQueue: sourceRun.taskQueue,
          priority: sourceRun.priority,
          currentStepKey: attempt.stepKey,
          input: sourceRun.input,
          context: attempt.contextBefore,
          traceContext: getActiveTraceContext() ?? null,
        },
        client
      )

      const nextRun = mapRun(requireRow(nextRunRow, "Failed to insert branched run"))

      if (args.mode === "rewind") {
        const [supersededRow] = await markRunSupersededQuery.run(
          {
            runId: sourceRun.id,
            supersededByRunId: nextRun.id,
          },
          client
        )

        if (!supersededRow) {
          throw new Error(`Run "${args.runId}" could not be marked as rewound`)
        }
      }

      await insertEventQuery.run(
        {
          runId: sourceRun.id,
          stepKey: attempt.stepKey,
          eventType: args.mode === "rewind" ? "run.rewound" : "run.forked",
          payload: {
            attemptId: attempt.id,
            stepKey: attempt.stepKey,
            branchedRunId: nextRun.id,
          },
        },
        client
      )

      await insertEventQuery.run(
        {
          runId: nextRun.id,
          stepKey: nextRun.currentStepKey,
          eventType: "run.started",
          payload: {
            branchMode: args.mode,
            branchedFromRunId: sourceRun.id,
            branchedFromAttemptId: attempt.id,
            stepSeq: attempt.stepSeq,
          },
        },
        client
      )

      await notifyRunnable()
      await notifyRunEvent(sourceRun.id)
      await notifyRunEvent(nextRun.id)
          return nextRun
        })
    )

  const recoverExpiredLeases = async (args: { limit: number }) =>
    withStoreSpan(
      {
        name: "recover_expired_leases",
        attributes: {
          "hippo.operation": "store.recover_expired_leases",
          "workflow.recovery.limit": args.limit,
        },
      },
      async () => {
        const [row] = await recoverExpiredLeasesQuery.run(args, db)
        const reclaimed = requireRow(
          row,
          "Failed to recover expired leases"
        ).reclaimedCount ?? 0

        if (reclaimed > 0) {
          await notifyRunnable()
        }

        return reclaimed
      }
    )

  return {
    advanceTaskStep,
    beginStepAttempt,
    branchRun,
    cancelRun,
    cancelRunAtBoundary,
    claimNextRunnableRun,
    claimOutboxMessages,
    completeStepAttempt,
    completeRun,
    continueAsNew,
    countOpenWaits,
    createSchedule,
    createSignal,
    consumeSignal,
    enqueueOutbox,
    extendLease,
    executeTransactionalTask,
    expireOpenWaits,
    failStepAttempt,
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
    listRunLineage,
    listRuns,
    listRunsPaginated,
    listSchedules,
    listStuckRuns,
    markOutboxDelivered,
    markRunCompensationFailed,
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
