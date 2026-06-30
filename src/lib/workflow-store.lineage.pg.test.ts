import { describe, expect, it } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
  childStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  setupTestDatabase,
  testDatabaseUrl,
} from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - lineage", () => {
  const { getStore } = setupTestDatabase()

  it("rewinds and forks from a stored attempt snapshot", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "rewind-fork-example",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          next: "second",
          run: () => ({
            patch: {
              count: 1,
            },
          }),
        }),
        second: taskStep({
          kind: "task",
          next: "done",
          run: (context) => ({
            patch: {
              count: Number(context.context.count ?? 0) + 1,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const sourceRun = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const sourceAttempts = await store.getRunAttempts(sourceRun.id)
    const secondAttempt = sourceAttempts.find(
      (attempt) => attempt.stepKey === "second"
    )

    expect(secondAttempt?.contextBefore).toEqual({ count: 1 })

    const rewoundRun = await store.branchRun({
      runId: sourceRun.id,
      attemptId: secondAttempt?.id ?? "",
      mode: "rewind",
    })

    expect(rewoundRun).not.toBeNull()
    expect(rewoundRun?.currentStepKey).toBe("second")
    expect(rewoundRun?.context).toEqual({ count: 1 })

    const updatedSourceRun = await store.getRun(sourceRun.id)

    expect(updatedSourceRun?.supersededByRunId).toBe(rewoundRun?.id ?? null)

    await drainEngine(engine)

    const completedRewoundRun = await store.getRun(rewoundRun?.id ?? "")

    expect(completedRewoundRun?.status).toBe("completed")
    expect(completedRewoundRun?.context.count).toBe(2)

    const forkedRun = await store.branchRun({
      runId: sourceRun.id,
      attemptId: secondAttempt?.id ?? "",
      mode: "fork",
    })

    expect(forkedRun).not.toBeNull()
    expect(forkedRun?.currentStepKey).toBe("second")
    expect(forkedRun?.context).toEqual({ count: 1 })

    await drainEngine(engine)

    const completedForkedRun = await store.getRun(forkedRun?.id ?? "")

    expect(completedForkedRun?.status).toBe("completed")
    expect(completedForkedRun?.context.count).toBe(2)

    const sourceEvents = await store.getRunEvents(sourceRun.id)

    expect(sourceEvents.some((event) => event.eventType === "run.rewound")).toBe(
      true
    )
    expect(sourceEvents.some((event) => event.eventType === "run.forked")).toBe(
      true
    )
  })

  it("rewinds a non-terminal run and cancels it, its child runs, and waits recursively", async () => {
    const store = getStore()
    const childWorkflow = defineWorkflow({
      name: "nonterm-child",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          next: "done",
          run: () => ({ patch: { ok: true } }),
        }),
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "nonterm-parent",
      version: 1,
      startAt: "spawn",
      steps: {
        spawn: childStep({
          kind: "child",
          workflow: childWorkflow.name,
          next: "done",
          input: () => ({}),
          resume: () => ({}),
        }),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow],
      metrics: createMetrics(),
      store,
    })

    const parentRun = await engine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 15000)

    const sourceParent = await store.getRun(parentRun.id)
    expect(sourceParent?.status).toBe("waiting")

    const childRuns = await store.listChildRuns(parentRun.id)
    expect(childRuns.length).toBe(1)
    const childRun = childRuns[0]!
    expect(childRun.status).toBe("queued")

    const parentAttempts = await store.getRunAttempts(parentRun.id)
    const spawnAttempt = parentAttempts.find((a) => a.stepKey === "spawn")
    expect(spawnAttempt).toBeDefined()

    const rewoundParent = await store.branchRun({
      runId: parentRun.id,
      attemptId: spawnAttempt!.id,
      mode: "rewind",
    })

    expect(rewoundParent).not.toBeNull()

    const updatedParent = await store.getRun(parentRun.id)
    expect(updatedParent?.supersededByRunId).toBe(rewoundParent!.id)
    expect(updatedParent?.status).toBe("canceled")

    const updatedChild = await store.getRun(childRun.id)
    expect(updatedChild?.status).toBe("canceled")

    await store.cancelRun({
      runId: rewoundParent!.id,
      reason: "Clean up",
    })
  })

  it("lists filtered runs and lineage through the real SQL store queries", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "lineage-query-example",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: {
              branchable: true,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const sourceRun = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const sourceAttempts = await store.getRunAttempts(sourceRun.id)
    const firstAttempt = sourceAttempts.find((attempt) => attempt.stepKey === "first")

    const forkedRun = await store.branchRun({
      runId: sourceRun.id,
      attemptId: firstAttempt?.id ?? "",
      mode: "fork",
    })

    if (!forkedRun) {
      throw new Error("Expected a forked run")
    }

    const childRun = await store.startRun({
      definitionName: workflow.name,
      definitionVersion: workflow.version,
      taskQueue: "default",
      priority: 0,
      input: {},
      currentStepKey: workflow.startAt,
      parentRunId: sourceRun.id,
      parentStepKey: "spawn-child",
    })

    const filteredRuns = await store.listRuns({
      limit: 10,
      status: "queued",
      workflowName: workflow.name,
    })
    const lineage = await store.listRunLineage(forkedRun.id)

    expect(filteredRuns.some((run) => run.id === forkedRun.id)).toBe(true)
    expect(lineage.map((run) => run.id)).toContain(sourceRun.id)
    expect(lineage.map((run) => run.id)).toContain(forkedRun.id)
    expect(lineage.map((run) => run.id)).not.toContain(childRun.id)
  })
})
