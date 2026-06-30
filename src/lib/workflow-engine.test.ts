import { describe, expect, it, vi } from "vitest"

import {
  childStep,
  defineWorkflow,
  endStep,
  externalSession,
  fanOut,
  humanTask,
  signalStep,
  sleepStep,
  taskStep,
  waitStep,
} from "./workflow-definition.js"
import { getFanOutJoinState, isFanOutWaitPayload } from "./engine/fan-out.js"
import { isHumanTaskWaitPayload, verifyHumanTaskToken } from "./engine/human-task.js"
import { createMetrics } from "./metrics.js"
import { createHippoTracer } from "./tracing.js"
import { createRecordingTracer } from "./tracing.test-helpers.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  SignalRecord,
  StepExecutionContext,
  TaskStepResult,
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkflowStepAttemptRecord,
  WorkflowWaitRecord,
} from "../types/workflow.js"

const drainEngine = async (
  engine: ReturnType<typeof createWorkflowEngine>,
  maxTicks = 1_000
) => {
  for (let index = 0; index < maxTicks; index += 1) {
    const result = await engine.tick("test-worker", 5_000)

    if (!result) {
      return
    }
  }

  throw new Error(`Engine did not drain within ${maxTicks} ticks`)
}

const getGaugeValue = async (metricName: string, metrics: ReturnType<typeof createMetrics>) => {
  const output = await metrics.registry.metrics()
  const line = output
    .split("\n")
    .find((candidate) => candidate.startsWith(`${metricName} `))

  if (!line) {
    throw new Error(`Metric "${metricName}" was not found`)
  }

  return Number(line.slice(metricName.length + 1))
}

const requireNumber = (value: JsonValue | undefined, label: string) => {
  if (typeof value !== "number") {
    throw new Error(`${label} must be a number`)
  }

  return value
}

const createStoreStub = () => {
  const runs = new Map<string, WorkflowRunRecord>()
  const waits = new Map<string, WorkflowWaitRecord>()
  const signals: SignalRecord[] = []
  const events: WorkflowEventRecord[] = []
  const attempts: WorkflowStepAttemptRecord[] = []
  const usageRows: Array<{
    id: string
    runId: string
    stepAttemptId: string | null
    resource: string
    amount: number
    costUsd: number | null
    dimension: string | null
    recordedAt: Date
  }> = []
  let runCounter = 0
  let waitCounter = 0
  let attemptCounter = 0
  let eventCounter = 0
  let usageCounter = 0
  const kvs = new Map<string, JsonValue>()
  const runIdempotencyKeys = new Map<string, string>()

  const now = () => new Date()

  const appendEvent = (args: {
    runId: string
    stepKey: string | null
    eventType: string
    payload?: JsonObject
  }) => {
    const event: WorkflowEventRecord = {
      id: ++eventCounter,
      runId: args.runId,
      stepKey: args.stepKey,
      eventType: args.eventType,
      payload: args.payload ?? {},
      createdAt: now(),
    }
    events.push(event)
    return event
  }

  const wakeParentForChildRun = (childRun: WorkflowRunRecord) => {
    if (!childRun.parentRunId || !childRun.parentStepKey) {
      return false
    }

    const correlationKey = `child:${childRun.parentRunId}:${childRun.parentStepKey}`
    const wait = waits.get(correlationKey)

    if (!wait || wait.status !== "open") {
      return false
    }

    wait.status = "resumed"
    wait.resumePayload = {
      childRunId: childRun.id,
      childStatus: childRun.status,
    }
    wait.resumedAt = now()

    const parentRun = runs.get(childRun.parentRunId)

    if (!parentRun) {
      return false
    }

    runs.set(parentRun.id, {
      ...parentRun,
      status: "queued",
      availableAt: now(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    return true
  }

  const wakeParentForFanOutChildRun = (childRun: WorkflowRunRecord) => {
    if (!childRun.parentRunId || !childRun.parentStepKey) {
      return false
    }

    const fanOutWait = [...waits.values()].find(
      (wait) =>
        wait.runId === childRun.parentRunId &&
        wait.stepKey === childRun.parentStepKey &&
        wait.status === "open" &&
        isFanOutWaitPayload(wait.payload) &&
        wait.payload.childRunId === childRun.id
    )

    if (!fanOutWait) {
      return false
    }

    fanOutWait.status = "resumed"
    fanOutWait.resumePayload = {
      childRunId: childRun.id,
      childStatus: childRun.status,
    }
    fanOutWait.resumedAt = now()

    const siblingWaits = [...waits.values()].filter(
      (wait) => wait.runId === childRun.parentRunId && wait.stepKey === childRun.parentStepKey
    )
    const siblingRuns = [...runs.values()].filter(
      (run) => run.parentRunId === childRun.parentRunId && run.parentStepKey === childRun.parentStepKey
    )
    const joinState = getFanOutJoinState({
      childRuns: siblingRuns,
      waits: siblingWaits,
    })

    if (joinState.failureMode === "fail-fast" && joinState.hasFailure) {
      for (const siblingRun of siblingRuns) {
        if (
          ["completed", "failed", "compensation_failed", "exhausted_budget", "canceled"].includes(
            siblingRun.status
          )
        ) {
          continue
        }

        runs.set(siblingRun.id, {
          ...siblingRun,
          status: "canceled",
          completedAt: now(),
          leaseOwner: null,
          leaseExpiresAt: null,
        })

        const siblingWait = siblingWaits.find(
          (wait) =>
            wait.status === "open" &&
            isFanOutWaitPayload(wait.payload) &&
            wait.payload.childRunId === siblingRun.id
        )

        if (siblingWait) {
          siblingWait.status = "resumed"
          siblingWait.resumePayload = {
            childRunId: siblingRun.id,
            childStatus: "canceled",
          }
          siblingWait.resumedAt = now()
        }
      }
    }

    const finalSiblingWaits = [...waits.values()].filter(
      (wait) => wait.runId === childRun.parentRunId && wait.stepKey === childRun.parentStepKey
    )
    const finalSiblingRuns = [...runs.values()].filter(
      (run) => run.parentRunId === childRun.parentRunId && run.parentStepKey === childRun.parentStepKey
    )
    const finalJoinState = getFanOutJoinState({
      childRuns: finalSiblingRuns,
      waits: finalSiblingWaits,
    })

    if (!finalJoinState.ready) {
      return false
    }

    const parentRun = runs.get(childRun.parentRunId)

    if (!parentRun) {
      return false
    }

    runs.set(parentRun.id, {
      ...parentRun,
      status: "queued",
      availableAt: now(),
      leaseOwner: null,
      leaseExpiresAt: null,
    })
    return true
  }

  return {
    async advanceTaskStep(args: {
      runId: string
      stepKey: string
      workerId: string
      attemptId: string
      nextStepKey: string
      context: JsonObject
      output: JsonValue | null
    }) {
      const run = runs.get(args.runId)!
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: args.nextStepKey,
        context: args.context,
        leaseOwner: null,
        leaseExpiresAt: null,
        availableAt: now(),
      }
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = args.output
      attempt.completedAt = now()
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "step.completed",
        payload: { nextStepKey: args.nextStepKey },
      })
      return next
    },
    async beginStepAttempt(args: {
      runId: string
      stepKey: string
      kind?: "forward" | "compensate"
      input: JsonObject
    }) {
      const kind = args.kind ?? "forward"
      const attempt: WorkflowStepAttemptRecord = {
        id: `attempt-${++attemptCounter}`,
        runId: args.runId,
        stepKey: args.stepKey,
        kind,
        stepSeq: attempts.filter((candidate) => candidate.runId === args.runId)
          .length + 1,
        attempt:
          attempts.filter(
            (candidate) =>
              candidate.runId === args.runId &&
              candidate.stepKey === args.stepKey &&
              candidate.kind === kind
          ).length + 1,
        status: "started",
        contextBefore: runs.get(args.runId)?.context ?? {},
        input: args.input,
        output: null,
        error: null,
        startedAt: now(),
        lastHeartbeatAt: null,
        completedAt: null,
        createdAt: now(),
        updatedAt: now(),
      }
      attempts.push(attempt)
      return attempt
    },
    async claimNextRunnableRun() {
      const run = [...runs.values()].find(
        (candidate) =>
          candidate.status === "queued" &&
          candidate.currentStepKey !== null &&
          candidate.availableAt <= now()
      )

      if (!run) {
        return null
      }

      const claimed = {
        ...run,
        status: "running" as const,
        leaseOwner: "test-worker",
        leaseExpiresAt: new Date(Date.now() + 5_000),
      }

      runs.set(run.id, claimed)
      return claimed
    },
    async completeRun(args: {
      runId: string
      context: JsonObject
      result: JsonValue | null
    }) {
      const run = runs.get(args.runId)!
      const next: WorkflowRunRecord = {
        ...run,
        status: "completed",
        currentStepKey: null,
        context: args.context,
        result: args.result,
        completedAt: now(),
        leaseOwner: null,
        leaseExpiresAt: null,
        availableAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({ runId: run.id, stepKey: run.currentStepKey, eventType: "run.completed" })
      if (!wakeParentForChildRun(next)) {
        wakeParentForFanOutChildRun(next)
      }
      return next
    },
    async continueAsNew(args: {
      runId: string
      stepKey: string
      attemptId: string
      context: JsonObject
      currentStepKey: string
      input: JsonObject
      taskQueue: string
      priority: number
    }) {
      const run = runs.get(args.runId)!
      const nextRun: WorkflowRunRecord = {
        id: `run-${++runCounter}`,
        parentRunId: null,
        parentStepKey: null,
        continuedFromRunId: run.id,
        branchedFromRunId: null,
        branchedFromAttemptRunId: null,
        branchedFromAttemptId: null,
        supersededByRunId: null,
        definitionName: run.definitionName,
        definitionVersion: run.definitionVersion,
        taskQueue: args.taskQueue,
        priority: args.priority,
        status: "queued",
        currentStepKey: args.currentStepKey,
        input: args.input,
        context: {},
        result: null,
        error: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        cancelRequestedAt: null,
        cancelMode: null,
        availableAt: now(),
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      }
      const completedRun: WorkflowRunRecord = {
        ...run,
        currentStepKey: null,
        context: args.context,
        result: { continuedRunId: nextRun.id },
        status: "completed",
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: now(),
        updatedAt: now(),
      }
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = { continuedRunId: nextRun.id }
      attempt.completedAt = now()
      runs.set(run.id, completedRun)
      runs.set(nextRun.id, nextRun)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "run.continued_as_new",
        payload: { continuedRunId: nextRun.id },
      })
      appendEvent({
        runId: nextRun.id,
        stepKey: nextRun.currentStepKey,
        eventType: "run.started",
        payload: { continuedFromRunId: run.id },
      })
      return nextRun
    },
    async completeStepAttempt(args: {
      attemptId: string
      output: JsonValue | null
      runId: string
      stepKey: string
    }) {
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = args.output
      attempt.completedAt = now()
      appendEvent({
        runId: args.runId,
        stepKey: args.stepKey,
        eventType: "compensation.completed",
      })
      return attempt
    },
    async countOpenWaits() {
      return [...waits.values()].filter((wait) => wait.status === "open").length
    },
    async consumeSignal(args: { runId: string; signalName: string }) {
      const signal = signals.find(
        (candidate) =>
          candidate.runId === args.runId &&
          candidate.signalName === args.signalName &&
          candidate.consumedAt === null
      )

      if (!signal) {
        return null
      }

      signal.consumedAt = now()
      signal.updatedAt = now()
      return signal
    },
    async createSignal(args: {
      runId: string
      signalName: string
      payload: JsonValue | null
    }) {
      signals.push({
        id: `signal-${signals.length + 1}`,
        runId: args.runId,
        signalName: args.signalName,
        payload: args.payload,
        consumedAt: null,
        createdAt: now(),
        updatedAt: now(),
      })
      const run = runs.get(args.runId)
      if (!run) {
        return null
      }

      if (run.status === "waiting") {
        runs.set(args.runId, {
          ...run,
          status: "queued",
          leaseOwner: null,
          leaseExpiresAt: null,
          availableAt: now(),
        })
      }

      return args.runId
    },
    async extendLease() {
      return true
    },
    async emitStepEvent(args: {
      runId: string
      stepKey: string
      stepAttemptId: string
      type: string
      data: JsonValue
    }) {
      return appendEvent({
        runId: args.runId,
        stepKey: args.stepKey,
        eventType: `step.emit:${args.type}`,
        payload: {
          type: args.type,
          data: args.data,
          stepKey: args.stepKey,
          stepAttemptId: args.stepAttemptId,
        },
      })
    },
    async expireOpenWaits(args: { limit: number }) {
      let expiredCount = 0

      for (const wait of [...waits.values()].slice(0, args.limit)) {
        if (
          wait.status === "open" &&
          wait.expiresAt !== null &&
          wait.expiresAt.getTime() < now().getTime()
        ) {
          wait.status = "expired"
          wait.updatedAt = now()
          if (isHumanTaskWaitPayload(wait.payload)) {
            const run = runs.get(wait.runId)

            if (run) {
              runs.set(wait.runId, {
                ...run,
                status: "queued",
                currentStepKey: wait.payload.timeout.nextStepKey,
                context: wait.payload.timeout.context,
                result: wait.payload.timeout.output,
                error: null,
                availableAt: now(),
                leaseOwner: null,
                leaseExpiresAt: null,
              })
            }
          } else if (isFanOutWaitPayload(wait.payload)) {
            const childRun = runs.get(wait.payload.childRunId)

            if (childRun && !["completed", "failed", "compensation_failed", "exhausted_budget", "canceled"].includes(childRun.status)) {
              const canceledChildRun: WorkflowRunRecord = {
                ...childRun,
                status: "canceled",
                completedAt: now(),
                leaseOwner: null,
                leaseExpiresAt: null,
              }
              runs.set(childRun.id, canceledChildRun)
              wakeParentForFanOutChildRun(canceledChildRun)
            }

            const siblingWaits = [...waits.values()].filter(
              (candidate) => candidate.runId === wait.runId && candidate.stepKey === wait.stepKey
            )
            const siblingRuns = [...runs.values()].filter(
              (candidate) => candidate.parentRunId === wait.runId && candidate.parentStepKey === wait.stepKey
            )
            const joinState = getFanOutJoinState({
              childRuns: siblingRuns,
              waits: siblingWaits,
            })
            const parentRun = runs.get(wait.runId)

            if (joinState.ready && parentRun) {
              runs.set(parentRun.id, {
                ...parentRun,
                status: "queued",
                availableAt: now(),
                leaseOwner: null,
                leaseExpiresAt: null,
              })
            }
          } else {
            const run = runs.get(wait.runId)
            if (run) {
              runs.set(wait.runId, {
                ...run,
                status: "failed",
                error: { message: "Wait step expired" },
                completedAt: now(),
              })
            }
          }
          expiredCount += 1
        }
      }

      return expiredCount
    },
    async cancelRun() {
      throw new Error("not used")
    },
    async cancelRunAtBoundary() {
      throw new Error("not used")
    },
    async claimOutboxMessages() {
      return []
    },
    async createSchedule() {
      throw new Error("not used")
    },
    async enqueueOutbox() {
      return undefined
    },
    async executeTransactionalTask(args: {
      run: WorkflowRunRecord
      stepKey: string
      workerId: string
      nextStepKey?: string
      runTask: (context: StepExecutionContext) => Promise<TaskStepResult> | TaskStepResult
      mergeContext: (left: JsonObject, right?: JsonObject) => JsonObject
    }) {
      const kv = {
        get: async (key: string) => kvs.get(`${args.run.id}:${key}`) ?? null,
        set: async (key: string, value: JsonValue) => { kvs.set(`${args.run.id}:${key}`, value) },
        delete: async (key: string) => { kvs.delete(`${args.run.id}:${key}`) },
      }

      const result = await args.runTask({
        run: {
          ...args.run,
          kv,
        },
        input: args.run.input,
        context: args.run.context,
        now: now(),
        attempt: 1,
        idempotencyKey: `${args.run.id}:${args.stepKey}`,
        heartbeat: async () => false,
        emit: async (event) => {
          appendEvent({
            runId: args.run.id,
            stepKey: args.stepKey,
            eventType: `step.emit:${event.type}`,
            payload: {
              type: event.type,
              data: event.data,
              stepKey: args.stepKey,
              stepAttemptId: "transactional-attempt",
            },
          })
        },
        recordUsage: async (usage) => {
          usageRows.push({
            id: `usage-${++usageCounter}`,
            runId: args.run.id,
            stepAttemptId: "transactional-attempt",
            resource: usage.resource,
            amount: usage.amount,
            costUsd: usage.costUsd ?? null,
            dimension: usage.dimension ?? null,
            recordedAt: now(),
          })
        },
        db: {
          query: async () => ({
            rows: [],
          }),
        },
        outbox: {
          enqueue: async () => undefined,
        },
        transactional: true,
        kv,
      })
      const run = runs.get(args.run.id)!
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: result.transition ?? args.nextStepKey ?? "done",
        context: args.mergeContext(run.context, result.patch),
        leaseOwner: null,
        leaseExpiresAt: null,
        availableAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "step.completed",
        payload: { nextStepKey: next.currentStepKey ?? "done" },
      })
      return {
        outcome: "completed" as const,
        run: next,
      }
    },
    async failRun(args: {
      runId: string
      stepKey: string
      attemptId: string
      error: JsonObject
    }) {
      const run = runs.get(args.runId)!
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "failed"
      attempt.error = args.error
      attempt.completedAt = now()
      const next: WorkflowRunRecord = {
        ...run,
        status: "failed",
        error: args.error,
        completedAt: now(),
        leaseOwner: null,
        leaseExpiresAt: null,
      }
      runs.set(run.id, next)
      appendEvent({ runId: run.id, stepKey: args.stepKey, eventType: "step.failed", payload: args.error })
      if (!wakeParentForChildRun(next)) {
        wakeParentForFanOutChildRun(next)
      }
      return next
    },
    async failStepAttempt(args: {
      attemptId: string
      error: JsonObject
      runId: string
      stepKey: string
    }) {
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "failed"
      attempt.error = args.error
      attempt.completedAt = now()
      appendEvent({
        runId: args.runId,
        stepKey: args.stepKey,
        eventType: "compensation.failed",
        payload: args.error,
      })
      return attempt
    },
    async getRun(runId: string) {
      return runs.get(runId) ?? null
    },
    async fireDueSchedules() {
      return []
    },
    async getChildRun(args: { parentRunId: string; parentStepKey: string }) {
      return (
        [...runs.values()].find(
          (run) =>
            run.parentRunId === args.parentRunId &&
            run.parentStepKey === args.parentStepKey
        ) ?? null
      )
    },
    async getRunAttempts(runId: string) {
      return attempts.filter((attempt) => attempt.runId === runId)
    },
    async getRunEvents(runId: string) {
      return events.filter((event) => event.runId === runId)
    },
    async getRunUsage(runId: string) {
      return usageRows.filter((usage) => usage.runId === runId)
    },
    async listActiveRuns() {
      return [...runs.values()].filter((run) =>
        ["queued", "running", "waiting"].includes(run.status)
      )
    },
    async listChildRuns(parentRunId: string) {
      return [...runs.values()].filter((run) => run.parentRunId === parentRunId)
    },
    async listStepWaits(args: { runId: string; stepKey: string }) {
      return [...waits.values()].filter(
        (wait) => wait.runId === args.runId && wait.stepKey === args.stepKey
      )
    },
    async listFailedRuns() {
      return [...runs.values()].filter((run) => run.status === "failed")
    },
    async listOpenExternalSessions(runId: string) {
      return [...waits.values()].filter(
        (wait) =>
          wait.runId === runId &&
          wait.status === "open" &&
          wait.externalSessionId !== null
      )
    },
    async listSchedules() {
      return []
    },
    async listStuckRuns() {
      return []
    },
    async markOutboxDelivered() {
      return true
    },
    async markRunCompensationFailed(args: {
      runId: string
      stepKey: string
      error: JsonObject
    }) {
      const run = runs.get(args.runId)!
      const next: WorkflowRunRecord = {
        ...run,
        status: "compensation_failed",
        error: args.error,
        completedAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "run.compensation_failed",
        payload: args.error,
      })
      return next
    },
    async openWait(args: {
      runId: string
      stepKey: string
      correlationKey: string
      payload: JsonValue | null
      expiresAt: Date | null
      output: JsonValue | null
      attemptId: string
      context: JsonObject
      externalSessionId?: string | null
      externalSessionKind?: string | null
    }) {
      const run = runs.get(args.runId)!
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = args.output
      attempt.completedAt = now()
      attempt.externalSessionId = args.externalSessionId ?? null
      attempt.externalSessionKind = args.externalSessionKind ?? null
      waits.set(args.correlationKey, {
        id: `wait-${++waitCounter}`,
        runId: run.id,
        stepKey: args.stepKey,
        correlationKey: args.correlationKey,
        status: "open",
        payload: args.payload,
        resumePayload: null,
        resumeOutput: null,
        expiresAt: args.expiresAt,
        createdAt: now(),
        updatedAt: now(),
        resumedAt: null,
        externalSessionId: args.externalSessionId ?? null,
        externalSessionKind: args.externalSessionKind ?? null,
      })
      const next: WorkflowRunRecord = {
        ...run,
        status: "waiting",
        context: args.context,
        leaseOwner: null,
        leaseExpiresAt: null,
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "wait.opened",
        payload: { correlationKey: args.correlationKey },
      })
      return next
    },
    async openFanOutWaits(args: {
      runId: string
      stepKey: string
      waits: Array<{
        correlationKey: string
        payload: JsonObject
        expiresAt: Date | null
      }>
      output: JsonValue | null
      attemptId: string
      context: JsonObject
    }) {
      const run = runs.get(args.runId)!
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = args.output
      attempt.completedAt = now()

      for (const waitInput of args.waits) {
        waits.set(waitInput.correlationKey, {
          id: `wait-${++waitCounter}`,
          runId: run.id,
          stepKey: args.stepKey,
          correlationKey: waitInput.correlationKey,
          status: "open",
          payload: waitInput.payload,
          resumePayload: null,
          resumeOutput: null,
          expiresAt: waitInput.expiresAt,
          createdAt: now(),
          updatedAt: now(),
          resumedAt: null,
          externalSessionId: null,
          externalSessionKind: null,
        })
      }

      const next: WorkflowRunRecord = {
        ...run,
        status: "waiting",
        context: args.context,
        leaseOwner: null,
        leaseExpiresAt: null,
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "wait.opened",
        payload: { count: args.waits.length },
      })
      return next
    },
    async ping() {
      return true
    },
    async recordExternalHeartbeat() {
      return {
        status: "missing" as const,
        runId: null,
        stepKey: null,
        attemptId: null,
      }
    },
    async recordExternalSessionEvent(args: {
      externalSessionId: string
      type: string
      data: JsonValue
    }) {
      const wait = [...waits.values()].find(
        (candidate) =>
          candidate.externalSessionId === args.externalSessionId &&
          candidate.status === "open"
      )

      if (!wait) {
        return {
          status: "missing" as const,
          runId: null,
          stepKey: null,
          attemptId: null,
          eventId: null,
        }
      }

      const attempt = attempts.find(
        (candidate) =>
          candidate.runId === wait.runId &&
          candidate.stepKey === wait.stepKey &&
          candidate.externalSessionId === args.externalSessionId
      )

      if (!attempt) {
        return {
          status: "stale" as const,
          runId: wait.runId,
          stepKey: wait.stepKey,
          attemptId: null,
          eventId: null,
        }
      }

      const event = appendEvent({
        runId: wait.runId,
        stepKey: wait.stepKey,
        eventType: `step.emit:${args.type}`,
        payload: {
          type: args.type,
          data: args.data,
          stepKey: wait.stepKey,
          stepAttemptId: attempt.id,
        },
      })

      return {
        status: "recorded" as const,
        runId: wait.runId,
        stepKey: wait.stepKey,
        attemptId: attempt.id,
        eventId: event.id,
      }
    },
    async recordUsage(args: {
      runId: string
      stepAttemptId: string | null
      usage: {
        resource: string
        amount: number
        costUsd?: number
        dimension?: string
      }
    }) {
      const row = {
        id: `usage-${++usageCounter}`,
        runId: args.runId,
        stepAttemptId: args.stepAttemptId,
        resource: args.usage.resource,
        amount: args.usage.amount,
        costUsd: args.usage.costUsd ?? null,
        dimension: args.usage.dimension ?? null,
        recordedAt: now(),
      }
      usageRows.push(row)
      return row
    },
    async resumeWait(args: {
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
    }) {
      const wait = waits.get(args.correlationKey)
      if (!wait) {
        return { status: "missing" as const, run: null }
      }
      const run = runs.get(wait.runId)!
      if (wait.status !== "open") {
        return { status: "duplicate" as const, run }
      }
      const resumed = await args.resume(run, wait)
      wait.status = "resumed"
      wait.resumePayload = args.payload ?? null
      wait.resumeOutput = resumed.output
      wait.resumedAt = now()
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: resumed.nextStepKey,
        context: resumed.context,
        error: null,
        availableAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: wait.stepKey,
        eventType: "wait.resumed",
        payload: { nextStepKey: resumed.nextStepKey },
      })
      return { status: "resumed" as const, run: next }
    },
    async resumeExternalSession(args: {
      externalSessionId: string
      payload: JsonValue | undefined
      resume: (
        run: WorkflowRunRecord,
        wait: WorkflowWaitRecord
      ) => Promise<{
        nextStepKey: string
        context: JsonObject
        output: JsonValue | null
      }>
    }) {
      const wait = [...waits.values()].find(
        (candidate) => candidate.externalSessionId === args.externalSessionId
      )
      if (!wait) {
        return { status: "missing" as const, run: null }
      }
      const run = runs.get(wait.runId)!
      if (wait.status !== "open") {
        return { status: "duplicate" as const, run }
      }
      const resumed = await args.resume(run, wait)
      wait.status = "resumed"
      wait.resumePayload = args.payload ?? null
      wait.resumeOutput = resumed.output
      wait.resumedAt = now()
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: resumed.nextStepKey,
        context: resumed.context,
        error: null,
        availableAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: wait.stepKey,
        eventType: "wait.resumed",
        payload: { nextStepKey: resumed.nextStepKey },
      })
      return { status: "resumed" as const, run: next }
    },
    async consumeSignalAndResumeWait(args: {
      correlationKey: string
      signalName: string
      resume: (signalPayload: JsonValue | undefined) => Promise<{
        nextStepKey: string
        context: JsonObject
        output: JsonValue | null
      }>
    }) {
      const wait = waits.get(args.correlationKey)
      if (!wait) {
        return { status: "missing" as const, run: null }
      }
      const run = runs.get(wait.runId)!
      if (wait.status !== "open") {
        return { status: "duplicate" as const, run }
      }
      if (run.status !== "waiting" || run.currentStepKey !== wait.stepKey) {
        return { status: "duplicate" as const, run }
      }
      const signal = signals.find(
        (candidate) =>
          candidate.runId === run.id &&
          candidate.signalName === args.signalName &&
          candidate.consumedAt === null
      )
      if (!signal) {
        return { status: "no_signal" as const, run }
      }
      signal.consumedAt = now()
      signal.updatedAt = now()
      const resumed = await args.resume(signal.payload ?? undefined)
      wait.status = "resumed"
      wait.resumePayload = signal.payload
      wait.resumeOutput = resumed.output
      wait.resumedAt = now()
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: resumed.nextStepKey,
        context: resumed.context,
        error: null,
        availableAt: now(),
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: wait.stepKey,
        eventType: "wait.resumed",
        payload: { nextStepKey: resumed.nextStepKey },
      })
      return { status: "resumed" as const, run: next }
    },
    async scheduleRetry(args: {
      runId: string
      stepKey: string
      attemptId: string
      availableAt: Date
      error: JsonObject
    }) {
      const run = runs.get(args.runId)!
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "failed"
      attempt.error = args.error
      attempt.completedAt = now()
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        error: args.error,
        availableAt: args.availableAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "step.retry_scheduled",
        payload: { availableAt: args.availableAt.toISOString() },
      })
      return next
    },
    async scheduleSleep(args: {
      runId: string
      stepKey: string
      nextStepKey: string
      availableAt: Date
    }) {
      const run = runs.get(args.runId)!
      const next: WorkflowRunRecord = {
        ...run,
        status: "queued",
        currentStepKey: args.nextStepKey,
        availableAt: args.availableAt,
        leaseOwner: null,
        leaseExpiresAt: null,
      }
      runs.set(run.id, next)
      appendEvent({
        runId: run.id,
        stepKey: args.stepKey,
        eventType: "step.scheduled",
        payload: { availableAt: args.availableAt.toISOString() },
      })
      return next
    },
    async queryStepDatabase() {
      return { rows: [] }
    },
    async requestCancelRun() {
      throw new Error("not used")
    },
    async listRunLineage(runId: string) {
      const run = runs.get(runId)
      return run ? [run] : []
    },
    async listRuns() {
      return [...runs.values()]
    },
    async listRunsPaginated() {
      return [...runs.values()]
    },
    async branchRun() {
      throw new Error("not used")
    },
    async startRun(args: {
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
    }) {
      if (args.idempotencyKey) {
        const existingRun = [...runs.values()].find(
          (run) =>
            run.definitionName === args.definitionName &&
            run.parentRunId === (args.parentRunId ?? null) &&
            run.parentStepKey === (args.parentStepKey ?? null) &&
            runIdempotencyKeys.get(run.id) === args.idempotencyKey
        )

        if (existingRun) {
          return existingRun
        }
      }

      const run: WorkflowRunRecord = {
        id: `run-${++runCounter}`,
        parentRunId: args.parentRunId ?? null,
        parentStepKey: args.parentStepKey ?? null,
        continuedFromRunId: null,
        branchedFromRunId: null,
        branchedFromAttemptRunId: null,
        branchedFromAttemptId: null,
        supersededByRunId: null,
        definitionName: args.definitionName,
        definitionVersion: args.definitionVersion,
        taskQueue: args.taskQueue,
        priority: args.priority,
        status: "queued",
        currentStepKey: args.currentStepKey,
        input: args.input,
        context: {},
        result: null,
        error: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        cancelRequestedAt: null,
        cancelMode: null,
        availableAt: now(),
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      }
      runs.set(run.id, run)
      if (args.idempotencyKey) {
        runIdempotencyKeys.set(run.id, args.idempotencyKey)
      }
      appendEvent({ runId: run.id, stepKey: run.currentStepKey, eventType: "run.started" })
      return run
    },
    async recoverExpiredLeases() {
      return 0
    },
    async retryRun() {
      throw new Error("not used")
    },
    async wakeParentForChild(childRun: WorkflowRunRecord) {
      return wakeParentForChildRun(childRun) || wakeParentForFanOutChildRun(childRun)
    },
    async getRunKV(runId: string, key: string) {
      return kvs.get(`${runId}:${key}`) ?? null
    },
    async setRunKV(runId: string, key: string, value: JsonValue) {
      kvs.set(`${runId}:${key}`, value)
    },
    async deleteRunKV(runId: string, key: string) {
      kvs.delete(`${runId}:${key}`)
    },
  }
}

describe("workflow engine", () => {
  it("runs a task workflow to completion", async () => {
      const workflow = defineWorkflow({
      name: "test-workflow",
      version: 1,
      startAt: "start",
      steps: {
        start: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: { delivered: true },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "test-workflow",
      payload: { hello: "world" },
    })

    await engine.tick("test-worker", 5_000)
    const queued = await store.getRun(run.id)

    expect(queued?.status).toBe("queued")
    expect(queued?.currentStepKey).toBe("done")
    expect(queued?.context).toEqual({ delivered: true })

    await engine.tick("test-worker", 5_000)
    const completed = await store.getRun(run.id)

    expect(completed?.status).toBe("completed")
  })

  it("emits nested spans while claiming and executing a step", async () => {
    const workflow = defineWorkflow({
      name: "traced-workflow",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: {
              ok: true,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const recording = createRecordingTracer()
    const tracer = createHippoTracer({
      tracer: recording.tracer,
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
      tracer,
    })

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    recording.spans.length = 0

    await engine.tick("test-worker", 5_000)

    const tickSpan = recording.spans.find((span) => span.name === "hippo.workflow.tick")
    const stepSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )
    const taskSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.task.run"
    )

    expect(tickSpan).toBeDefined()
    expect(stepSpan?.parentName).toBe("hippo.workflow.tick")
    expect(taskSpan?.parentName).toBe("hippo.workflow.step.execute")
  })

  it("adds attempt and retry metadata to retried task spans", async () => {
    let attempts = 0
    const workflow = defineWorkflow({
      name: "traced-retry-workflow",
      version: 1,
      startAt: "unstable",
      steps: {
        unstable: taskStep({
          kind: "task",
          next: "done",
          retry: {
            maxAttempts: 2,
            initialBackoffMs: 0,
          },
          run: () => {
            attempts += 1

            if (attempts === 1) {
              throw new Error("boom")
            }

            return {
              patch: { ok: true },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const recording = createRecordingTracer()
    const tracer = createHippoTracer({
      tracer: recording.tracer,
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
      tracer,
    })

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
      taskQueue: "priority",
      priority: 7,
    })

    await engine.tick("test-worker", 5_000)
    recording.spans.length = 0
    await engine.tick("test-worker", 5_000)

    const stepSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )

    expect(stepSpan?.attributes["workflow.attempt.number"]).toBe(2)
    expect(stepSpan?.attributes["workflow.retry.count"]).toBe(1)
    expect(stepSpan?.attributes["workflow.task_queue"]).toBe("priority")
    expect(stepSpan?.attributes["workflow.priority"]).toBe(7)
  })

  it("adds wait correlation keys and child run ids to step spans", async () => {
    const childWorkflow = defineWorkflow({
      name: "trace-child",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "trace-parent",
      version: 1,
      startAt: "child",
      steps: {
        child: childStep({
          kind: "child",
          workflow: childWorkflow.name,
          next: "done",
          input: () => ({ ok: true }),
          resume: (_context, childRun) => ({
            output: childRun.result,
          }),
        }),
        done: endStep(),
      },
    })
    const waitWorkflow = defineWorkflow({
      name: "trace-wait",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: (context) => ({
            correlationKey: `wait:${context.run.id}:approval`,
          }),
          resume: () => ({}),
        }),
        done: endStep(),
      },
    })
    const childStore = createStoreStub()
    const childRecording = createRecordingTracer()
    const childTracer = createHippoTracer({
      tracer: childRecording.tracer,
    })
    const childEngine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow, waitWorkflow],
      metrics: createMetrics(),
      store: childStore,
      tracer: childTracer,
    })

    const parentRun = await childEngine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })
    childRecording.spans.length = 0
    await childEngine.tick("test-worker", 5_000)

    const childStartSpan = childRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.child.start"
    )
    const childStepSpan = childRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )

    expect(childStartSpan?.attributes["workflow.child.run_id"]).toBeDefined()
    expect(childStepSpan?.attributes["workflow.child.run_id"]).toBeDefined()
    expect(childStepSpan?.attributes["workflow.wait.correlation_key"]).toBe(
      `child:${parentRun.id}:child`
    )

    const waitStore = createStoreStub()
    const waitRecording = createRecordingTracer()
    const waitTracer = createHippoTracer({
      tracer: waitRecording.tracer,
    })
    const waitEngine = createWorkflowEngine({
      definitions: [waitWorkflow],
      metrics: createMetrics(),
      store: waitStore,
      tracer: waitTracer,
    })

    const waitRun = await waitEngine.startRun({
      workflowName: waitWorkflow.name,
      payload: {},
    })
    waitRecording.spans.length = 0
    await waitEngine.tick("test-worker", 5_000)

    const waitOpenSpan = waitRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.wait.open"
    )

    expect(waitOpenSpan?.attributes["workflow.wait.correlation_key"]).toBe(
      `wait:${waitRun.id}:approval`
    )
  })

  it("continues a run as new from a task step", async () => {
    const workflow = defineWorkflow({
      name: "continue-as-new-workflow",
      version: 1,
      startAt: "start",
      steps: {
        start: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            continueAsNew: {
              payload: { cursor: 2 },
              taskQueue: "bulk",
              priority: 9,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const originalRun = await engine.startRun({
      workflowName: workflow.name,
      payload: { cursor: 1 },
      taskQueue: "default",
      priority: 1,
    })
    const continuedRun = await engine.tick("test-worker", 5_000, [
      "default",
      "bulk",
    ])

    expect(continuedRun?.continuedFromRunId).toBe(originalRun.id)
    expect(continuedRun?.taskQueue).toBe("bulk")
    expect(continuedRun?.priority).toBe(9)
    expect(continuedRun?.input).toEqual({ cursor: 2 })

    const completedOriginal = await store.getRun(originalRun.id)
    expect(completedOriginal?.status).toBe("completed")
    expect(completedOriginal?.result).toEqual({
      continuedRunId: continuedRun?.id,
    })
  })

  it("resumes a wait exactly once in the store contract", async () => {
    const workflow = defineWorkflow({
      name: "wait-workflow",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: () => ({ correlationKey: "abc123" }),
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    await engine.startRun({
      workflowName: "wait-workflow",
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    const first = await engine.resumeWait({
      correlationKey: "abc123",
      payload: { status: "ok" },
    })
    const second = await engine.resumeWait({
      correlationKey: "abc123",
      payload: { status: "ok" },
    })

    expect(first.status).toBe("resumed")
    expect(first.run?.currentStepKey).toBe("done")
    expect(second.status).toBe("duplicate")
    expect(second.run?.id).toBe(first.run?.id)
  })

  it("opens and resumes an external session step by external id", async () => {
    const workflow = defineWorkflow({
      name: "external-workflow",
      version: 1,
      startAt: "transcode",
      steps: {
        transcode: externalSession({
          sessionKind: "video-transcode",
          next: "done",
          timeoutMs: 60_000,
          start: () => ({
            externalId: "transcode-123",
            payload: { status: "started" },
          }),
          resume: (_context, externalId, payload) => ({
            patch: { externalId, callback: payload ?? null },
            output: { status: "complete" },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "external-workflow",
      payload: {},
    })
    const waiting = await engine.tick("test-worker", 5_000)

    expect(waiting?.status).toBe("waiting")

    const [attempt] = await store.getRunAttempts(run.id)
    expect(attempt?.output).toEqual({ status: "started" })

    const first = await engine.resumeExternalSession({
      externalSessionId: "transcode-123",
      payload: { resultUrl: "s3://bucket/out.mp4" },
    })
    const second = await engine.resumeExternalSession({
      externalSessionId: "transcode-123",
      payload: { resultUrl: "s3://bucket/out.mp4" },
    })

    expect(first.status).toBe("resumed")
    expect(first.run?.currentStepKey).toBe("done")
    expect(first.run?.context).toMatchObject({
      externalId: "transcode-123",
      callback: { resultUrl: "s3://bucket/out.mp4" },
    })
    expect(second.status).toBe("duplicate")
    expect(second.run?.id).toBe(first.run?.id)
  })

  it("cancels open external sessions before hard cancellation", async () => {
    const canceledExternalIds: string[] = []
    const workflow = defineWorkflow({
      name: "external-cancel-workflow",
      version: 1,
      startAt: "transcode",
      steps: {
        transcode: externalSession({
          sessionKind: "video-transcode",
          next: "done",
          timeoutMs: 60_000,
          start: () => ({
            externalId: "transcode-cancel-123",
          }),
          cancel: (_context, externalId) => {
            canceledExternalIds.push(externalId)
          },
          resume: () => ({
            patch: {},
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    const result = await engine.cancelExternalSessionsForRun(run.id)

    expect(result.attempted).toBe(1)
    expect(canceledExternalIds).toEqual(["transcode-cancel-123"])
  })

  it("schedules retries instead of failing immediately when configured", async () => {
    const workflow = defineWorkflow({
      name: "retry-workflow",
      version: 1,
      startAt: "unstable",
      steps: {
        unstable: taskStep({
          kind: "task",
          next: "done",
          retry: {
            maxAttempts: 2,
            initialBackoffMs: 10,
          },
          run: () => {
            throw new Error("boom")
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "retry-workflow",
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    const queued = await store.getRun(run.id)

    expect(queued?.status).toBe("queued")
    expect(queued?.currentStepKey).toBe("unstable")
  })

  it("applies exponential backoff with jitter and a max cap", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"))
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(1)

    try {
      const workflow = defineWorkflow({
        name: "capped-retry-workflow",
        version: 1,
        startAt: "unstable",
        steps: {
          unstable: taskStep({
            kind: "task",
            next: "done",
            retry: {
              maxAttempts: 3,
              initialBackoffMs: 100,
              backoffMultiplier: 3,
              maxBackoffMs: 250,
              jitterMs: 25,
            },
            run: () => {
              throw new Error("boom")
            },
          }),
          done: endStep(),
        },
      })
      const store = createStoreStub()
      const engine = createWorkflowEngine({
        definitions: [workflow],
        metrics: createMetrics(),
        store,
      })

      const run = await engine.startRun({
        workflowName: "capped-retry-workflow",
        payload: {},
      })

      await engine.tick("test-worker", 5_000)
      const firstRetry = await store.getRun(run.id)

      expect(firstRetry?.availableAt.getTime()).toBe(
        Date.parse("2024-01-01T00:00:00.125Z")
      )

      vi.setSystemTime(firstRetry?.availableAt ?? new Date())
      await engine.tick("test-worker", 5_000)
      const secondRetry = await store.getRun(run.id)

      expect(
        (secondRetry?.availableAt.getTime() ?? 0) -
          (firstRetry?.availableAt.getTime() ?? 0)
      ).toBe(250)
    } finally {
      randomSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it("supports sleep scheduling", async () => {
    const workflow = defineWorkflow({
      name: "sleep-workflow",
      version: 1,
      startAt: "pause",
      steps: {
        pause: sleepStep({
          kind: "sleep",
          next: "done",
          until: 50,
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "sleep-workflow",
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    const scheduled = await store.getRun(run.id)

    expect(scheduled?.status).toBe("queued")
    expect(scheduled?.currentStepKey).toBe("done")
    expect((scheduled?.availableAt.getTime() ?? 0) > Date.now()).toBe(true)
  })

  it("drains a bulk workload without leaking run state", async () => {
    const workflow = defineWorkflow({
      name: "bulk-workflow",
      version: 1,
      startAt: "annotate",
      steps: {
        annotate: taskStep({
          kind: "task",
          next: "done",
          run: ({ input }) => {
            const runIndex = requireNumber(input.runIndex, "runIndex")

            return {
              patch: {
                runIndex,
                checksum: `run-${String(runIndex)}`,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const metrics = createMetrics()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics,
      store,
    })

    const runs = await Promise.all(
      Array.from({ length: 250 }, (_, runIndex) =>
        engine.startRun({
          workflowName: workflow.name,
          payload: { runIndex },
        })
      )
    )

    await drainEngine(engine)

    const completedRuns = await Promise.all(
      runs.map((run) => store.getRun(run.id))
    )

    expect(completedRuns).toHaveLength(250)

    for (const [runIndex, run] of completedRuns.entries()) {
      expect(run?.status).toBe("completed")
      expect(run?.context).toEqual({
        runIndex,
        checksum: `run-${String(runIndex)}`,
      })
      expect(run?.result).toEqual({
        runIndex,
        checksum: `run-${String(runIndex)}`,
      })
    }
  })

  it("persists step body emitted events", async () => {
    const workflow = defineWorkflow({
      name: "step-event-workflow",
      version: 1,
      startAt: "build",
      steps: {
        build: taskStep({
          kind: "task",
          next: "done",
          run: async ({ emit }) => {
            await emit({
              type: "progress",
              data: {
                pct: 0.5,
              },
            })

            return {
              patch: {
                emitted: true,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const events = await store.getRunEvents(run.id)
    const emitted = events.find(
      (event) => event.eventType === "step.emit:progress"
    )

    expect(emitted).toMatchObject({
      runId: run.id,
      stepKey: "build",
      payload: {
        type: "progress",
        data: {
          pct: 0.5,
        },
        stepKey: "build",
        stepAttemptId: "attempt-1",
      },
    })
  })

  it("persists step body usage records", async () => {
    const workflow = defineWorkflow({
      name: "usage-workflow",
      version: 1,
      startAt: "count",
      steps: {
        count: taskStep({
          kind: "task",
          next: "done",
          run: async ({ recordUsage }) => {
            await recordUsage({
              resource: "tokens",
              amount: 120,
              costUsd: 0.02,
              dimension: "output",
            })

            return {
              patch: {
                counted: true,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const usage = await store.getRunUsage(run.id)

    expect(usage).toMatchObject([
      {
        runId: run.id,
        stepAttemptId: "attempt-1",
        resource: "tokens",
        amount: 120,
        costUsd: 0.02,
        dimension: "output",
      },
    ])
  })

  it("completes after bounded retries and preserves the final patch", async () => {
    const attemptsByRun = new Map<string, number>()
    const workflow = defineWorkflow({
      name: "eventual-success",
      version: 1,
      startAt: "unstable",
      steps: {
        unstable: taskStep({
          kind: "task",
          next: "done",
          retry: {
            maxAttempts: 3,
            initialBackoffMs: 0,
          },
          run: ({ run }) => {
            const attempt = (attemptsByRun.get(run.id) ?? 0) + 1
            attemptsByRun.set(run.id, attempt)

            if (attempt < 3) {
              throw new Error(`attempt-${String(attempt)}`)
            }

            return {
              patch: { settledAtAttempt: attempt },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine, 10)

    const completed = await store.getRun(run.id)
    const events = await store.getRunEvents(run.id)

    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ settledAtAttempt: 3 })
    expect(
      events.filter((event) => event.eventType === "step.retry_scheduled")
    ).toHaveLength(2)
  })

  it("updates the open wait gauge after a wait resumes", async () => {
    const workflow = defineWorkflow({
      name: "wait-metrics",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: () => ({ correlationKey: "wait-metrics-key" }),
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const metrics = createMetrics()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics,
      store,
    })

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    expect(await getGaugeValue("hippo_waits_open", metrics)).toBe(1)

    const resumed = await engine.resumeWait({
      correlationKey: "wait-metrics-key",
      payload: { ok: true },
    })

    expect(resumed.status).toBe("resumed")
    expect(await getGaugeValue("hippo_waits_open", metrics)).toBe(0)
  })

  it("treats task timeouts as retryable failures", async () => {
    const workflow = defineWorkflow({
      name: "timeout-workflow",
      version: 1,
      startAt: "slow-step",
      steps: {
        "slow-step": taskStep({
          kind: "task",
          next: "done",
          timeoutMs: 5,
          retry: {
            maxAttempts: 2,
            initialBackoffMs: 0,
          },
          run: async () =>
            new Promise<TaskStepResult>((resolve) => {
              setTimeout(() => {
                resolve({ patch: { completed: true } })
              }, 20)
            }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const metrics = createMetrics()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics,
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    const queued = await store.getRun(run.id)
    const events = await store.getRunEvents(run.id)

    expect(queued?.status).toBe("queued")
    expect(
      events.some(
        (event) =>
          event.eventType === "step.retry_scheduled" &&
          String(event.payload.availableAt).length > 0
      )
    ).toBe(true)
  })

  it("does not retry tagged non-retryable task failures", async () => {
    const workflow = defineWorkflow({
      name: "non-retryable-workflow",
      version: 1,
      startAt: "reject",
      steps: {
        reject: taskStep({
          kind: "task",
          next: "done",
          retry: {
            maxAttempts: 5,
            initialBackoffMs: 0,
            nonRetryableErrorTags: ["VALIDATION"],
          },
          run: () => {
            const error = new Error("bad input") as Error & { tag: string }
            error.tag = "VALIDATION"
            throw error
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    const failed = await store.getRun(run.id)
    const events = await store.getRunEvents(run.id)

    expect(failed?.status).toBe("failed")
    expect(
      events.some((event) => event.eventType === "step.retry_scheduled")
    ).toBe(false)
  })

  it("exposes a heartbeat that extends a running lease", async () => {
    let heartbeatCalls = 0
    const workflow = defineWorkflow({
      name: "heartbeat-workflow",
      version: 1,
      startAt: "beat",
      steps: {
        beat: taskStep({
          kind: "task",
          next: "done",
          run: async ({ heartbeat }) => {
            if (await heartbeat()) {
              heartbeatCalls += 1
            }

            return {
              patch: { heartbeatCalls },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = {
      ...createStoreStub(),
      async extendLease() {
        return true
      },
    }
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const completed = await store.getRun(run.id)
    expect(heartbeatCalls).toBe(1)
    expect(completed?.context).toEqual({ heartbeatCalls: 1 })
  })

  it("buffers and consumes a signal step", async () => {
    const workflow = defineWorkflow({
      name: "signal-workflow",
      version: 1,
      startAt: "gate",
      steps: {
        gate: signalStep({
          kind: "signal",
          signal: "approved",
          next: "done",
          timeoutMs: 60_000,
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    expect((await store.getRun(run.id))?.status).toBe("waiting")

    await store.createSignal({
      runId: run.id,
      signalName: "approved",
      payload: { ok: true },
    })
    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)

    const completed = await store.getRun(run.id)
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ payload: { ok: true } })
  })

  it("consumes a signal that arrives during the running-to-waiting race window", async () => {
    let sendSignal: (() => Promise<void>) | undefined
    const workflow = defineWorkflow({
      name: "signal-race-workflow",
      version: 1,
      startAt: "gate",
      steps: {
        gate: signalStep({
          kind: "signal",
          signal: "approved",
          next: "done",
          timeoutMs: 60_000,
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
        }),
        done: endStep(),
      },
    })
    const baseStore = createStoreStub()
    const store = {
      ...baseStore,
      async openWait(args: {
        runId: string
        stepKey: string
        correlationKey: string
        payload: JsonValue | null
        expiresAt: Date | null
        output: JsonValue | null
        attemptId: string
        context: JsonObject
      }) {
        if (sendSignal) {
          await sendSignal()
          sendSignal = undefined
        }

        return baseStore.openWait(args)
      },
    }
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    sendSignal = () =>
      store.createSignal({
        runId: run.id,
        signalName: "approved",
        payload: { ok: "race" },
      }).then(() => undefined)

    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)

    const completed = await store.getRun(run.id)
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ payload: { ok: "race" } })
  })

  it("expires timed out waits during recovery", async () => {
    const workflow = defineWorkflow({
      name: "expiring-wait",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 1,
          open: () => ({ correlationKey: "expiring-key" }),
          resume: () => ({
            patch: {},
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBe(1)

    const failed = await store.getRun(run.id)
    expect(failed?.status).toBe("failed")
  })

  it("opens and resumes a human task with an approval payload", async () => {
    const workflow = defineWorkflow({
      name: "human-task-approve",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "done",
          transitions: {
            timeout: "timed-out",
          },
          timeoutMs: 60_000,
          open: ({ approvalUrl }) => ({
            prompt: {
              approvalUrl,
            },
          }),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
              data: decision.data ?? null,
            },
          }),
          timeout: {
            transition: "timed-out",
          },
        }),
        "timed-out": endStep(),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)

    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })
    expect(isHumanTaskWaitPayload(wait?.payload)).toBe(true)
    if (!wait || !isHumanTaskWaitPayload(wait.payload)) {
      throw new Error("expected human task wait payload")
    }

    const token = wait.payload.approvalUrl.split("/").at(-1)
    expect(token).toBeTruthy()

    const claims = verifyHumanTaskToken({
      token: token!,
      secret: "human-secret",
      toleranceSeconds: 300,
    })

    expect(claims?.correlationKey).toBe(wait.correlationKey)

    const resumed = await engine.resumeHumanTask({
      correlationKey: wait.correlationKey,
      decision: {
        decision: "approve",
        data: {
          reviewer: "alice",
        },
      },
    })
    await drainEngine(engine)

    const completed = await store.getRun(run.id)

    expect(resumed.status).toBe("resumed")
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toMatchObject({
      decision: "approve",
      data: {
        reviewer: "alice",
      },
    })
  })

  it("routes rejected human tasks through their transition", async () => {
    const workflow = defineWorkflow({
      name: "human-task-reject",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "approved",
          timeoutMs: 60_000,
          open: () => ({}),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
            },
            transition: decision.decision === "reject" ? "rejected" : "approved",
          }),
          timeout: {
            transition: "timed-out",
          },
          transitions: {
            timeout: "timed-out",
          },
        }),
        approved: endStep(),
        rejected: endStep(),
        "timed-out": endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)

    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })
    if (!wait) {
      throw new Error("expected review wait")
    }

    await engine.resumeHumanTask({
      correlationKey: wait.correlationKey,
      decision: {
        decision: "reject",
      },
    })
    await drainEngine(engine)

    const completed = await store.getRun(run.id)
    const resumedWaits = await store.listStepWaits({ runId: run.id, stepKey: "review" })

    expect(completed?.status).toBe("completed")
    expect(completed?.context.decision).toBe("reject")
    expect(resumedWaits[0]?.resumePayload).toEqual({
      decision: "reject",
    })
  })

  it("routes timed-out human tasks through their timeout transition", async () => {
    const workflow = defineWorkflow({
      name: "human-task-timeout",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "approved",
          timeoutMs: 1,
          open: () => ({}),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
            },
          }),
          timeout: {
            transition: "timed-out",
            patch: {
              timedOut: true,
            },
          },
          transitions: {
            timeout: "timed-out",
          },
        }),
        approved: endStep(),
        "timed-out": endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBe(1)
    await drainEngine(engine)

    const completed = await store.getRun(run.id)

    expect(completed?.status).toBe("completed")
    expect(completed?.currentStepKey).toBeNull()
    expect(completed?.context.timedOut).toBe(true)
  })

  it("runs child workflows and resumes the parent", async () => {
    const childWorkflow = defineWorkflow({
      name: "child-unit",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: {
              childValue: "ok",
            },
          }),
        }),
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "parent-unit",
      version: 1,
      startAt: "spawn",
      steps: {
        spawn: childStep({
          kind: "child",
          workflow: childWorkflow.name,
          next: "done",
          input: () => ({
            fromParent: true,
          }),
          resume: (_context, childRun) => ({
            patch: {
              childStatus: childRun.status,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow],
      metrics: createMetrics(),
      store,
    })

    const parentRun = await engine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const completedParent = await store.getRun(parentRun.id)
    const childRuns = await store.listChildRuns(parentRun.id)

    expect(completedParent?.status).toBe("completed")
    expect(completedParent?.context.childStatus).toBe("completed")
    expect(childRuns).toHaveLength(1)
    expect(childRuns[0]?.status).toBe("completed")
  })

  it("runs fan-out children and resumes with ordered terminal results", async () => {
    const childWorkflow = defineWorkflow({
      name: "fanout-child-unit",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: ({ input }) => {
            if (input["shouldFail"] === true) {
              throw new Error(`child-${String(input["index"])} failed`)
            }

            const index = requireNumber(input["index"], "fan-out child index")

            return {
              patch: {
                index,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "fanout-parent-unit",
      version: 1,
      startAt: "spread",
      steps: {
        spread: fanOut({
          next: "done",
          failureMode: "collect",
          children: () => [
            { workflow: childWorkflow.name, input: { index: 2 } },
            { workflow: childWorkflow.name, input: { index: 0, shouldFail: true } },
            { workflow: childWorkflow.name, input: { index: 1 } },
          ],
          resume: (_context, childRuns) => ({
            patch: {
              childStatuses: childRuns.map((run) => run.status),
              childIndexes: childRuns.map((run) => run.context["index"] ?? null),
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow],
      metrics: createMetrics(),
      store,
    })

    const parentRun = await engine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const completedParent = await store.getRun(parentRun.id)

    expect(completedParent?.status).toBe("completed")
    expect(completedParent?.context.childStatuses).toEqual([
      "completed",
      "failed",
      "completed",
    ])
    expect(completedParent?.context.childIndexes).toEqual([2, null, 1])
  })

  it("cancels remaining fan-out children in fail-fast mode", async () => {
    const childWorkflow = defineWorkflow({
      name: "fanout-failfast-child",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: ({ input }) => {
            if (input["shouldFail"] === true) {
              throw new Error("fail-fast-child")
            }

            return {
              patch: {
                ok: true,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "fanout-failfast-parent",
      version: 1,
      startAt: "spread",
      steps: {
        spread: fanOut({
          next: "done",
          failureMode: "fail-fast",
          children: () => [
            { workflow: childWorkflow.name, input: { shouldFail: true } },
            { workflow: childWorkflow.name, input: { shouldFail: false } },
          ],
          resume: (_context, childRuns) => ({
            patch: {
              childStatuses: childRuns.map((run) => run.status),
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow],
      metrics: createMetrics(),
      store,
    })

    const parentRun = await engine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const completedParent = await store.getRun(parentRun.id)
    const childRuns = await store.listChildRuns(parentRun.id)

    expect(completedParent?.status).toBe("completed")
    expect(completedParent?.context.childStatuses).toEqual(["failed", "canceled"])
    expect(childRuns.map((run) => run.status)).toEqual(["failed", "canceled"])
  })

  it("surfaces timed-out fan-out children to the join", async () => {
    const hangingChildWorkflow = defineWorkflow({
      name: "fanout-timeout-child",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: (context) => ({
            correlationKey: `child-hold:${context.run.id}`,
          }),
          resume: () => ({}),
        }),
        done: endStep(),
      },
    })
    const fastChildWorkflow = defineWorkflow({
      name: "fanout-timeout-fast-child",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "fanout-timeout-parent",
      version: 1,
      startAt: "spread",
      steps: {
        spread: fanOut({
          next: "done",
          timeoutMs: 1,
          join: {
            kind: "all",
          },
          children: () => [
            { workflow: fastChildWorkflow.name, input: { index: 0 } },
            { workflow: fastChildWorkflow.name, input: { index: 1 } },
            { workflow: hangingChildWorkflow.name, input: { index: 2 } },
          ],
          resume: (_context, childRuns) => ({
            patch: {
              childStatuses: childRuns.map((run) => run.status),
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, fastChildWorkflow, hangingChildWorkflow],
      metrics: createMetrics(),
      store,
    })

    const parentRun = await engine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })

    await drainEngine(engine)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBeGreaterThan(0)
    await drainEngine(engine)

    const completedParent = await store.getRun(parentRun.id)

    expect(completedParent?.status).toBe("completed")
    expect(completedParent?.context.childStatuses).toEqual([
      "completed",
      "completed",
      "canceled",
    ])
  })

  it("compensates completed steps when a run fails", async () => {
    const compensate = vi.fn(async (_context: StepExecutionContext, cause: JsonValue | null) => {
      expect(cause).toMatchObject({
        message: "explode",
      })
    })
    const workflow = defineWorkflow({
      name: "compensate-on-failure",
      version: 1,
      startAt: "charge",
      steps: {
        charge: taskStep({
          kind: "task",
          next: "explode",
          run: () => ({
            patch: {
              charged: true,
            },
          }),
          compensate,
        }),
        explode: taskStep({
          kind: "task",
          next: "done",
          run: () => {
            throw new Error("explode")
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const failedRun = await store.getRun(run.id)
    const attempts = await store.getRunAttempts(run.id)

    expect(failedRun?.status).toBe("failed")
    expect(compensate).toHaveBeenCalledTimes(1)
    expect(
      attempts.filter(
        (attempt) =>
          attempt.kind === "compensate" &&
          attempt.stepKey === "charge" &&
          attempt.status === "completed"
      )
    ).toHaveLength(1)
  })

  it("marks the run when compensation exhausts its retries", async () => {
    const workflow = defineWorkflow({
      name: "compensation-failure",
      version: 1,
      startAt: "charge",
      steps: {
        charge: taskStep({
          kind: "task",
          next: "explode",
          run: () => ({
            patch: {
              charged: true,
            },
          }),
          compensate: {
            retry: {
              maxAttempts: 2,
              initialBackoffMs: 0,
              jitterMs: 0,
            },
            run: () => {
              throw new Error("undo failed")
            },
          },
        }),
        explode: taskStep({
          kind: "task",
          next: "done",
          run: () => {
            throw new Error("explode")
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const failedRun = await store.getRun(run.id)
    const attempts = await store.getRunAttempts(run.id)

    expect(failedRun?.status).toBe("compensation_failed")
    expect(
      attempts.filter(
        (attempt) =>
          attempt.kind === "compensate" && attempt.stepKey === "charge"
      )
    ).toHaveLength(2)
  })

  it("dispatches transactional tasks through the transactional store path", async () => {
    const workflow = defineWorkflow({
      name: "transactional-unit",
      version: 1,
      startAt: "save",
      steps: {
        save: taskStep({
          kind: "task",
          transactional: true,
          next: "done",
          run: async (context) => {
            expect(context.transactional).toBe(true)
            await context.outbox.enqueue({
              topic: "email",
              payload: {
                ok: true,
              },
            })
            await context.emit({
              type: "audit",
              data: {
                saved: true,
              },
            })
            return {
              patch: {
                saved: true,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const transactionalStore = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store: transactionalStore,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const completed = await transactionalStore.getRun(run.id)
    const events = await transactionalStore.getRunEvents(run.id)

    expect(completed?.status).toBe("completed")
    expect(completed?.context.saved).toBe(true)
    expect(
      events.some(
        (event) =>
          event.eventType === "step.emit:audit" &&
          event.payload.stepAttemptId === "transactional-attempt"
      )
    ).toBe(true)
  })

  it("replaces workflow definitions while preserving pinned versions", async () => {
    const workflowV1 = defineWorkflow({
      name: "hot-reloadable",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Version one",
        }),
      },
    })
    const workflowV2 = defineWorkflow({
      name: "hot-reloadable",
      version: 2,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Version two",
        }),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflowV1],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([workflowV2])

    expect(engine.getWorkflow("hot-reloadable").version).toBe(2)
    expect(engine.getWorkflow("hot-reloadable", 1).version).toBe(1)
    expect(
      engine.listWorkflowVersions().map((workflow) => workflow.version)
    ).toEqual([1, 2])
  })

  it("does not overwrite an already-registered version during hot reload", async () => {
    const original = defineWorkflow({
      name: "same-version",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Original",
        }),
      },
    })
    const edited = defineWorkflow({
      name: "same-version",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Edited",
        }),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [original],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([edited])

    expect(engine.getWorkflow("same-version", 1).steps.done).toMatchObject({
      label: "Original",
    })
    expect(engine.getWorkflow("same-version").steps.done).toMatchObject({
      label: "Original",
    })
  })

  it("removes deleted workflows from the latest registration set", async () => {
    const keep = defineWorkflow({
      name: "keep",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const remove = defineWorkflow({
      name: "remove",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [keep, remove],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([keep])

    expect(engine.listWorkflows().map((workflow) => workflow.name)).toEqual([
      "keep",
    ])
    expect(engine.hasWorkflow("remove")).toBe(false)
    expect(engine.getWorkflow("remove", 1).name).toBe("remove")
  })

  it("stores, retrieves, and deletes values in the run-scoped KV store", async () => {
    const values: unknown[] = []
    const workflow = defineWorkflow({
      name: "kv-test",
      version: 1,
      startAt: "set-step",
      steps: {
        "set-step": taskStep({
          kind: "task",
          next: "get-step",
          run: async (ctx) => {
            await ctx.kv.set("my-key", "hello-world")
            // Also test ctx.run.kv compatibility
            await ctx.run.kv.set("my-compat-key", 42)
            return {
              patch: { setDone: true }
            }
          }
        }),
        "get-step": taskStep({
          kind: "task",
          next: "delete-step",
          run: async (ctx) => {
            const val1 = await ctx.kv.get("my-key")
            const val2 = await ctx.run.kv.get("my-compat-key")
            values.push(val1, val2)
            return {
              patch: { getDone: true }
            }
          }
        }),
        "delete-step": taskStep({
          kind: "task",
          next: "done",
          run: async (ctx) => {
            await ctx.kv.delete("my-key")
            const val1 = await ctx.kv.get("my-key")
            values.push(val1)
            return {
              patch: { deleteDone: true }
            }
          }
        }),
        done: endStep()
      }
    })

    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "kv-test",
      payload: {},
    })

    // Tick through set-step
    await engine.tick("test-worker", 5_000)
    // Tick through get-step
    await engine.tick("test-worker", 5_000)
    // Tick through delete-step
    await engine.tick("test-worker", 5_000)
    // Tick through done step to complete the run
    await engine.tick("test-worker", 5_000)

    const completedRun = await store.getRun(run.id)
    expect(completedRun?.status).toBe("completed")
    expect(values).toEqual(["hello-world", 42, null])
  })
})
