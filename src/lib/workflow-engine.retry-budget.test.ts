import { describe, expect, it, vi } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import type { TaskStepResult } from "../types/workflow.js"
import {
  drainEngine,
  createStoreStub,
} from "./workflow-engine.test-helpers.js"

describe("workflow engine retries and budgets", () => {
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
})
