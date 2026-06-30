import { vi } from "vitest"
import { getFanOutJoinState, isFanOutWaitPayload } from "./engine/fan-out.js"
import { isHumanTaskWaitPayload } from "./engine/human-task.js"
import { createMetrics } from "./metrics.js"
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

export const drainEngine = async (
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

export const getGaugeValue = async (metricName: string, metrics: ReturnType<typeof createMetrics>) => {
  const output = await metrics.registry.metrics()
  const line = output
    .split("\n")
    .find((candidate) => candidate.startsWith(`${metricName} `))

  if (!line) {
    throw new Error(`Metric "${metricName}" was not found`)
  }

  return Number(line.slice(metricName.length + 1))
}

export const requireNumber = (value: JsonValue | undefined, label: string) => {
  if (typeof value !== "number") {
    throw new Error(`${label} must be a number`)
  }

  return value
}

export const createStoreStub = () => {
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
