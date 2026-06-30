import { describe, expect, it } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  setupTestDatabase,
  testDatabaseUrl,
} from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - attempts", () => {
  const { getPool, getStore } = setupTestDatabase()

  it("exhausts a workflow budget and rolls back transactional user writes", async () => {
    const pool = getPool()
    const store = getStore()
    const workflow = defineWorkflow({
      name: "transactional-budget",
      version: 1,
      startAt: "spend",
      budget: {
        resources: {
          tokens: 10,
        },
      },
      steps: {
        spend: taskStep({
          kind: "task",
          transactional: true,
          next: "done",
          run: async (context) => {
            await context.db.query(
              "CREATE TABLE IF NOT EXISTS app_budget_items (id text primary key)"
            )
            await context.db.query("INSERT INTO app_budget_items (id) VALUES ($1)", [
              context.idempotencyKey,
            ])
            await context.recordUsage({
              resource: "tokens",
              amount: 11,
            })

            return {
              patch: {
                shouldNotCommit: true,
              },
            }
          },
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

    await drainEngine(engine)

    const tableLookup = await pool.query<{ exists: string | null }>(
      "SELECT to_regclass('public.app_budget_items') AS exists"
    )
    const exhaustedRun = await store.getRun(run.id)
    const usage = await store.getRunUsage(run.id)
    const events = await store.getRunEvents(run.id)

    expect(tableLookup.rows[0]?.exists).toBeNull()
    expect(exhaustedRun?.status).toBe("exhausted_budget")
    expect(exhaustedRun?.currentStepKey).toBeNull()
    expect(usage).toMatchObject([
      {
        runId: run.id,
        resource: "tokens",
        amount: 11,
      },
    ])
    expect(
      events.some((event) => event.eventType === "run.exhausted_budget")
    ).toBe(true)
  })

  it("persists KV pairs inside transactional tasks, and rolls them back when transactional tasks fail", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "integration-kv-rollback",
      version: 1,
      startAt: "set-tx",
      steps: {
        "set-tx": taskStep({
          kind: "task",
          transactional: true,
          next: "fail-tx",
          run: async (ctx) => {
            await ctx.kv.set("tx-key", "tx-value")
            return {
              patch: { txDone: true }
            }
          }
        }),
        "fail-tx": taskStep({
          kind: "task",
          transactional: true,
          next: "done",
          run: async (ctx) => {
            await ctx.kv.set("fail-key", "should-rollback")
            throw new Error("force rollback")
          }
        }),
        done: endStep()
      }
    })

    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "integration-kv-rollback",
      payload: {},
      taskQueue: "kv-queue-rollback",
    })

    let result = await engine.tick("pg-test-worker", 15_000, ["kv-queue-rollback"])
    expect(result?.id).toBe(run.id)

    const val1 = await store.getRunKV(run.id, "tx-key")
    expect(val1).toBe("tx-value")

    result = await engine.tick("pg-test-worker", 15_000, ["kv-queue-rollback"])
    expect(result?.id).toBe(run.id)

    const val2 = await store.getRunKV(run.id, "fail-key")
    expect(val2).toBeNull()

    const val3 = await store.getRunKV(run.id, "tx-key")
    expect(val3).toBe("tx-value")
  })

  it("persists KV pairs inside non-transactional tasks", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "integration-kv-nontx",
      version: 1,
      startAt: "set-nontx",
      steps: {
        "set-nontx": taskStep({
          kind: "task",
          transactional: false,
          next: "done",
          run: async (ctx) => {
            await ctx.kv.set("nontx-key", "nontx-value")
            return {
              patch: { nontxDone: true }
            }
          }
        }),
        done: endStep()
      }
    })

    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "integration-kv-nontx",
      payload: {},
      taskQueue: "kv-queue-nontx",
    })

    let result = await engine.tick("pg-test-worker", 15_000, ["kv-queue-nontx"])
    expect(result?.id).toBe(run.id)

    const val = await store.getRunKV(run.id, "nontx-key")
    expect(val).toBe("nontx-value")
  })
})
