import { describe, expect, it } from "vitest"

import {
  defineWorkflow,
  endStep,
  sleepStep,
  taskStep,
  waitStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkflowStepAttemptRecord,
  WorkflowWaitRecord,
} from "../types/workflow.js"

const createStoreStub = () => {
  const runs = new Map<string, WorkflowRunRecord>()
  const waits = new Map<string, WorkflowWaitRecord>()
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
      return next
    },
    async countOpenWaits() {
      return [...waits.values()].filter((wait) => wait.status === "open").length
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
      return next
    },
    async getRun(runId: string) {
      return runs.get(runId) ?? null
    },
    async getRunEvents(runId: string) {
      return events.filter((event) => event.runId === runId)
    },
    async openWait(args: {
      runId: string
      stepKey: string
      correlationKey: string
      payload: JsonValue | null
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
      if (!wait || wait.status !== "open") {
        return null
      }
      const run = runs.get(wait.runId)!
      const resumed = await args.resume(run, wait)
      wait.status = "resumed"
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
      return next
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
    async startRun(args: {
      definitionName: string
      definitionVersion: number
      input: JsonObject
      currentStepKey: string
    }) {
      const run: WorkflowRunRecord = {
        id: `run-${++runCounter}`,
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
        availableAt: now(),
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
      }
      runs.set(run.id, run)
      appendEvent({ runId: run.id, stepKey: run.currentStepKey, eventType: "run.started" })
      return run
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
    const completed = await store.getRun(run.id)

    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ delivered: true })
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

    expect(first?.currentStepKey).toBe("done")
    expect(second).toBeNull()
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
            backoffMs: 10,
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
})
