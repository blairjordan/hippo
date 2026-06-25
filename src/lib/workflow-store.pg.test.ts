import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { Pool } from "pg"

import {
  childStep,
  defineWorkflow,
  endStep,
  taskStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import { createWorkflowStore } from "./workflow-store.js"

const testDatabaseUrl = process.env.HIPPO_PG_TEST_URL

const drainEngine = async (
  engine: ReturnType<typeof createWorkflowEngine>,
  maxTicks = 1_000
) => {
  for (let index = 0; index < maxTicks; index += 1) {
    const result = await engine.tick("pg-test-worker", 15_000)

    if (!result) {
      return
    }
  }

  throw new Error(`Engine did not drain within ${maxTicks} ticks`)
}

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration", () => {
  const databaseName = `hippo_test_${randomUUID().replaceAll("-", "_")}`
  const baseUrl = new URL(
    testDatabaseUrl ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres"
  )
  const adminUrl = new URL(baseUrl.toString())
  adminUrl.pathname = "/postgres"

  let pool: Pool
  let store: ReturnType<typeof createWorkflowStore>

  beforeAll(async () => {
    const adminPool = new Pool({
      connectionString: adminUrl.toString(),
    })
    const adminClient = await adminPool.connect()

    try {
      await adminClient.query(`CREATE DATABASE ${databaseName}`)
    } finally {
      adminClient.release()
      await adminPool.end()
    }

    const databaseUrl = new URL(baseUrl.toString())
    databaseUrl.pathname = `/${databaseName}`
    pool = new Pool({
      connectionString: databaseUrl.toString(),
    })

    const migrationsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../db/migrations"
    )
    const migrationFiles = (await readdir(migrationsDir)).sort()

    for (const migrationFile of migrationFiles) {
      const migrationSql = await readFile(
        path.join(migrationsDir, migrationFile),
        "utf8"
      )
      const schemaSql = migrationSql
        .split("-- migrate:down")[0]
        ?.replace("-- migrate:up", "")

      if (!schemaSql) {
        throw new Error(`Failed to load migration SQL from ${migrationFile}`)
      }

      await pool.query(schemaSql)
    }
    store = createWorkflowStore(pool)
  })

  afterAll(async () => {
    await pool.end()

    const adminPool = new Pool({
      connectionString: adminUrl.toString(),
    })
    const adminClient = await adminPool.connect()

    try {
      await adminClient.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()
        `,
        [databaseName]
      )
      await adminClient.query(`DROP DATABASE IF EXISTS ${databaseName}`)
    } finally {
      adminClient.release()
      await adminPool.end()
    }
  })

  it("commits user writes and outbox messages in the same transaction as a successful task", async () => {
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

    expect(savedRows.rows).toHaveLength(1)
    expect(savedRows.rows[0]?.id).toBe(`${run.id}:save`)
    expect(outboxRows.rows).toHaveLength(1)
    expect(outboxRows.rows[0]?.topic).toBe("email")
    expect(outboxRows.rows[0]?.payload.idempotencyKey).toBe(`${run.id}:save`)
    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.context.saved).toBe(true)
  })

  it("rolls back user writes and outbox messages when a transactional task fails", async () => {
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

    expect(tableLookup.rows[0]?.exists).toBeNull()
    expect(outboxRows.rows).toHaveLength(0)
    expect(failedRun?.status).toBe("failed")
  })

  it("runs child workflows and resumes the parent when the child completes", async () => {
    const childWorkflow = defineWorkflow({
      name: "child-example",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: {
              childValue: "ready",
            },
          }),
        }),
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "parent-example",
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
              childResult: childRun.context,
            },
          }),
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

    await drainEngine(engine)

    const childRuns = await store.listChildRuns(parentRun.id)
    const completedParent = await store.getRun(parentRun.id)

    expect(childRuns).toHaveLength(1)
    expect(childRuns[0]?.status).toBe("completed")
    expect(completedParent?.status).toBe("completed")
    expect(completedParent?.context.childStatus).toBe("completed")
    expect(completedParent?.context.childResult).toMatchObject({
      childValue: "ready",
    })
  })

  it("deduplicates run creation by workflow and idempotency key", async () => {
    const workflow = defineWorkflow({
      name: "idempotent-start",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const first = await engine.startRun({
      workflowName: workflow.name,
      payload: { orderId: "123" },
      idempotencyKey: "start-123",
    })
    const second = await engine.startRun({
      workflowName: workflow.name,
      payload: { orderId: "456" },
      idempotencyKey: "start-123",
    })

    expect(second.id).toBe(first.id)
    expect(second.input).toEqual({ orderId: "123" })

    const events = await store.getRunEvents(first.id)

    expect(
      events.filter((event) => event.eventType === "run.started")
    ).toHaveLength(1)

    await drainEngine(engine)
  })

  it("rewinds and forks from a stored attempt snapshot", async () => {
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
})
