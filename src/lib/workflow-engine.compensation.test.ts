import { describe, expect, it, vi } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import type { StepExecutionContext } from "../types/workflow.js"
import type { JsonValue } from "../types/json.js"
import {
  drainEngine,
  createStoreStub,
} from "./workflow-engine.test-helpers.js"

describe("workflow engine compensation", () => {
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
})
