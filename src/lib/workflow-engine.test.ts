import { describe, expect, it, vi } from "vitest"

import {
  childStep,
  defineWorkflow,
  endStep,
  signalStep,
  sleepStep,
  taskStep,
  waitStep,
} from "./workflow-definition.js"
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
  let runCounter = 0
  let waitCounter = 0
  let attemptCounter = 0
  let eventCounter = 0

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
      input: JsonObject
    }) {
      const attempt: WorkflowStepAttemptRecord = {
        id: `attempt-${++attemptCounter}`,
        runId: args.runId,
        stepKey: args.stepKey,
        attempt:
          attempts.filter(
            (candidate) =>
              candidate.runId === args.runId && candidate.stepKey === args.stepKey
          ).length + 1,
        status: "started",
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
      wakeParentForChildRun(next)
      return next
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
          const run = runs.get(wait.runId)
          if (run) {
            runs.set(wait.runId, {
              ...run,
              status: "failed",
              error: { message: "Wait step expired" },
              completedAt: now(),
            })
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
      const result = await args.runTask({
        run: args.run,
        input: args.run.input,
        context: args.run.context,
        now: now(),
        attempt: 1,
        idempotencyKey: `${args.run.id}:${args.stepKey}`,
        heartbeat: async () => false,
        db: {
          query: async () => ({
            rows: [],
          }),
        },
        outbox: {
          enqueue: async () => undefined,
        },
        transactional: true,
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
      wakeParentForChildRun(next)
      return next
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
    async listActiveRuns() {
      return [...runs.values()].filter((run) =>
        ["queued", "running", "waiting"].includes(run.status)
      )
    },
    async listChildRuns(parentRunId: string) {
      return [...runs.values()].filter((run) => run.parentRunId === parentRunId)
    },
    async listFailedRuns() {
      return [...runs.values()].filter((run) => run.status === "failed")
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
      const run = runs.get(args.runId)!
      const attempt = attempts.find((candidate) => candidate.id === args.attemptId)!
      attempt.status = "completed"
      attempt.output = args.output
      attempt.completedAt = now()
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
    async ping() {
      return true
    },
    async resumeWait(args: {
      correlationKey: string
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
      wait.resumePayload = null
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
    async startRun(args: {
      parentRunId?: string | null
      parentStepKey?: string | null
      definitionName: string
      definitionVersion: number
      input: JsonObject
      currentStepKey: string
    }) {
      const run: WorkflowRunRecord = {
        id: `run-${++runCounter}`,
        parentRunId: args.parentRunId ?? null,
        parentStepKey: args.parentStepKey ?? null,
        definitionName: args.definitionName,
        definitionVersion: args.definitionVersion,
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
      return wakeParentForChildRun(childRun)
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
    expect(completed?.status).toBe("completed")
    expect(completed?.context.saved).toBe(true)
  })
})
