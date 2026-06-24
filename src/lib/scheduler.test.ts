import { describe, expect, it, vi } from "vitest"

import { computeNextScheduleFireAt, startScheduleLoop } from "./scheduler.js"
import type { WorkflowEngine } from "./workflow-engine.js"
import type { WorkflowStore } from "./workflow-store.js"

describe("scheduler", () => {
  it("computes the next fire time from a cron expression", () => {
    const next = computeNextScheduleFireAt({
      cronExpression: "*/5 * * * *",
      currentDate: new Date("2026-01-01T00:01:00.000Z"),
    })

    expect(next.toISOString()).toBe("2026-01-01T00:05:00.000Z")
  })

  it("starts runs for due schedules", async () => {
    const startRun = vi.fn(async () => ({
      id: "run-1",
      parentRunId: null,
      parentStepKey: null,
      definitionName: "demo",
      definitionVersion: 1,
      status: "queued" as const,
      currentStepKey: "start",
      input: {},
      context: {},
      result: null,
      error: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      cancelRequestedAt: null,
      cancelMode: null,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    }))
    const engine = {
      getWorkflow() {
        throw new Error("not used")
      },
      hasWorkflow() {
        return true
      },
      listWorkflows() {
        return []
      },
      async resumeWait() {
        throw new Error("not used")
      },
      startRun,
      async tick() {
        return null
      },
    } satisfies WorkflowEngine
    const store = {
      async fireDueSchedules() {
        return [
          {
            id: "schedule-1",
            workflowName: "demo",
            cronExpression: "* * * * *",
            payload: { ok: true },
            active: true,
            nextFireAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
    } as Pick<WorkflowStore, "fireDueSchedules">

    const stop = startScheduleLoop({
      engine,
      intervalMs: 5,
      limit: 10,
      store: store as WorkflowStore,
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    await stop()

    expect(startRun).toHaveBeenCalledWith({
      workflowName: "demo",
      payload: { ok: true },
    })
  })
})
