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

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - outbox", () => {
  const { getPool, getStore } = setupTestDatabase()

  it("commits user writes and outbox messages in the same transaction as a successful task", async () => {
    const pool = getPool()
    const store = getStore()
    const workflow = defineWorkflow({
      name: "transactional-success",
      version: 1,
      startAt: "save",
      steps: {
        save: taskStep({
          kind: "task",
          transactional: true,
          next: "done",
          run: async (context) => {
            await context.db.query(
              "CREATE TABLE IF NOT EXISTS app_items (id text primary key, value text not null)"
            )
            await context.db.query(
              "INSERT INTO app_items (id, value) VALUES ($1, $2)",
              [context.idempotencyKey, "ok"]
            )
            await context.outbox.enqueue({
              topic: "email",
              payload: {
                idempotencyKey: context.idempotencyKey,
              },
            })
            await context.emit({
              type: "progress",
              data: {
                pct: 1,
              },
            })
            await context.recordUsage({
              resource: "tokens",
              amount: 25,
              costUsd: 0.01,
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

    const savedRows = await pool.query<{ id: string; value: string }>(
      "SELECT id, value FROM app_items"
    )
    const outboxRows = await pool.query<{
      topic: string
      payload: { idempotencyKey: string }
      delivered_at: Date | null
    }>("SELECT topic, payload, delivered_at FROM workflow_outbox")
    const completedRun = await store.getRun(run.id)
    const events = await store.getRunEvents(run.id)
    const usage = await store.getRunUsage(run.id)

    expect(savedRows.rows).toHaveLength(1)
    expect(savedRows.rows[0]?.id).toBe(`${run.id}:save`)
    expect(outboxRows.rows).toHaveLength(1)
    expect(outboxRows.rows[0]?.topic).toBe("email")
    expect(outboxRows.rows[0]?.payload.idempotencyKey).toBe(`${run.id}:save`)
    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.context.saved).toBe(true)
    expect(
      events.some(
        (event) =>
          event.eventType === "step.emit:progress" &&
          event.payload.stepKey === "save"
      )
    ).toBe(true)
    expect(usage).toMatchObject([
      {
        runId: run.id,
        resource: "tokens",
        amount: 25,
        costUsd: 0.01,
      },
    ])
  })

  it("rolls back user writes and outbox messages when a transactional task fails", async () => {
    const pool = getPool()
    const store = getStore()
    const workflow = defineWorkflow({
      name: "transactional-failure",
      version: 1,
      startAt: "save",
      steps: {
        save: taskStep({
          kind: "task",
          transactional: true,
          next: "done",
          run: async (context) => {
            await context.db.query(
              "CREATE TABLE IF NOT EXISTS app_failures (id text primary key, value text not null)"
            )
            await context.db.query(
              "INSERT INTO app_failures (id, value) VALUES ($1, $2)",
              [context.idempotencyKey, "nope"]
            )
            await context.outbox.enqueue({
              topic: "email",
              payload: {
                idempotencyKey: context.idempotencyKey,
              },
            })
            await context.emit({
              type: "progress",
              data: {
                pct: 0.25,
              },
            })
            await context.recordUsage({
              resource: "tokens",
              amount: 25,
              costUsd: 0.01,
            })

            throw new Error("boom")
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
      "SELECT to_regclass('public.app_failures') AS exists"
    )
    const outboxRows = await pool.query<{
      payload: { idempotencyKey: string }
    }>(
      `
        SELECT payload
        FROM workflow_outbox
        WHERE payload->>'idempotencyKey' = $1
      `,
      [`${run.id}:save`]
    )
    const failedRun = await store.getRun(run.id)
    const events = await store.getRunEvents(run.id)
    const usage = await store.getRunUsage(run.id)

    expect(tableLookup.rows[0]?.exists).toBeNull()
    expect(outboxRows.rows).toHaveLength(0)
    expect(failedRun?.status).toBe("failed")
    expect(
      events.some((event) => event.eventType === "step.emit:progress")
    ).toBe(false)
    expect(usage).toHaveLength(0)
  })
})
