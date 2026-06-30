import { describe, expect, it } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
  childStep,
  fanOut,
  waitStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  requireNumber,
  createStoreStub,
} from "./workflow-engine.test-helpers.js"

describe("workflow engine children and fanout", () => {
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
})
