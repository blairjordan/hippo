import { describe, expect, it } from "vitest"
import { defineWorkflow, endStep, signalStep } from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  setupTestDatabase,
  testDatabaseUrl,
} from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - signals", () => {
  const { getStore } = setupTestDatabase()

  it("buffers and consumes signals in postgres", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "pg-signal-workflow",
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
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("pg-test-worker", 15_000)
    expect((await store.getRun(run.id))?.status).toBe("waiting")

    await store.createSignal({
      runId: run.id,
      signalName: "approved",
      payload: { ok: true },
    })

    await engine.tick("pg-test-worker", 15_000)
    await drainEngine(engine)

    const completed = await store.getRun(run.id)
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ payload: { ok: true } })
  })
})
