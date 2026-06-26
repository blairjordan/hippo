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
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations"
)

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

const collectPlanRelationNames = (node: unknown): string[] => {
  if (!node || typeof node !== "object") {
    return []
  }

  const record = node as Record<string, unknown>
  const relationName =
    typeof record["Relation Name"] === "string"
      ? [record["Relation Name"]]
      : []
  const childPlans = Array.isArray(record.Plans)
    ? record.Plans.flatMap(collectPlanRelationNames)
    : []

  return [...relationName, ...childPlans]
}

const getExplainPlanRoot = (value: unknown): unknown => {
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as Array<Record<string, unknown>>
    return parsed[0]?.Plan ?? parsed[0]
  }

  if (Array.isArray(value)) {
    const first = value[0]

    if (first && typeof first === "object" && "Plan" in first) {
      return (first as { Plan?: unknown }).Plan ?? first
    }

    return first
  }

  return value
}

const readMigrationSection = async (
  migrationFile: string,
  section: "up" | "down"
) => {
  const migrationSql = await readFile(path.join(migrationsDir, migrationFile), "utf8")
  const [upBlock, downBlock = ""] = migrationSql.split("-- migrate:down")
  const selectedBlock = (section === "up" ? upBlock : downBlock) ?? ""
  const normalized = selectedBlock.replace(`-- migrate:${section}`, "").trim()

  if (normalized.length === 0) {
    throw new Error(`Failed to load ${section} migration SQL from ${migrationFile}`)
  }

  return normalized
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

  it("lists filtered runs and lineage through the real SQL store queries", async () => {
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

  it("round-trips the partition migration from legacy tables without losing lineage", async () => {
    const client = await pool.connect()
    const schemaName = `migration_roundtrip_${randomUUID().replaceAll("-", "_")}`
    const upSql = await readMigrationSection(
      "20260625180000_partition_history_tables.sql",
      "up"
    )
    const downSql = await readMigrationSection(
      "20260625180000_partition_history_tables.sql",
      "down"
    )
    const sourceRunId = randomUUID()
    const branchedRunId = randomUUID()
    const attemptId = randomUUID()

    try {
      await client.query(`CREATE SCHEMA ${schemaName}`)
      await client.query(`SET search_path TO ${schemaName}, public`)
      await client.query(`
        CREATE TYPE workflow_run_status AS ENUM (
          'queued',
          'running',
          'waiting',
          'completed',
          'failed',
          'compensation_failed',
          'canceled'
        );
        CREATE TYPE cancellation_mode AS ENUM ('graceful', 'hard');
        CREATE TYPE step_attempt_kind AS ENUM ('forward', 'compensation');
        CREATE TYPE step_attempt_status AS ENUM ('running', 'completed', 'failed');

        CREATE TABLE workflow_runs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          parent_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL,
          parent_step_key TEXT,
          continued_from_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL,
          branched_from_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL,
          branched_from_attempt_id UUID,
          superseded_by_run_id UUID REFERENCES workflow_runs (id) ON DELETE SET NULL,
          definition_name TEXT NOT NULL,
          definition_version INTEGER NOT NULL,
          task_queue TEXT NOT NULL,
          priority INTEGER NOT NULL DEFAULT 0,
          status workflow_run_status NOT NULL,
          current_step_key TEXT,
          input JSONB NOT NULL DEFAULT '{}'::jsonb,
          context JSONB NOT NULL DEFAULT '{}'::jsonb,
          result JSONB,
          error JSONB,
          lease_owner TEXT,
          lease_expires_at TIMESTAMPTZ,
          cancel_requested_at TIMESTAMPTZ,
          cancel_mode cancellation_mode,
          available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ
        );

        CREATE TABLE workflow_step_attempts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
          step_key TEXT NOT NULL,
          kind step_attempt_kind NOT NULL DEFAULT 'forward',
          step_seq INTEGER NOT NULL,
          attempt INTEGER NOT NULL,
          status step_attempt_status NOT NULL,
          context_before JSONB NOT NULL DEFAULT '{}'::jsonb,
          input JSONB NOT NULL DEFAULT '{}'::jsonb,
          output JSONB,
          error JSONB,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          last_heartbeat_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (run_id, step_key, kind, attempt)
        );

        CREATE INDEX workflow_step_attempts_run_id_idx
          ON workflow_step_attempts (run_id, step_key, kind, attempt DESC);

        CREATE UNIQUE INDEX workflow_step_attempts_run_id_step_seq_idx
          ON workflow_step_attempts (run_id, step_seq);

        CREATE TABLE workflow_events (
          id BIGSERIAL PRIMARY KEY,
          run_id UUID NOT NULL REFERENCES workflow_runs (id) ON DELETE CASCADE,
          step_key TEXT,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX workflow_events_run_id_idx
          ON workflow_events (run_id, created_at);

        ALTER TABLE workflow_runs
          ADD CONSTRAINT workflow_runs_branched_from_attempt_fkey
          FOREIGN KEY (branched_from_attempt_id)
          REFERENCES workflow_step_attempts (id)
          ON DELETE SET NULL;

        CREATE INDEX workflow_runs_branched_from_attempt_id_idx
          ON workflow_runs (branched_from_attempt_id);
      `)

      await client.query(
        `
          INSERT INTO workflow_runs (
            id,
            definition_name,
            definition_version,
            task_queue,
            priority,
            status,
            current_step_key,
            input,
            context,
            available_at,
            completed_at
          ) VALUES
            ($1, 'legacy-demo', 1, 'default', 0, 'completed', NULL, '{}'::jsonb, '{"count":1}'::jsonb, now(), now()),
            ($2, 'legacy-demo', 1, 'default', 0, 'queued', 'step-2', '{}'::jsonb, '{"count":1}'::jsonb, now(), NULL)
        `,
        [sourceRunId, branchedRunId]
      )
      await client.query(
        `
          INSERT INTO workflow_step_attempts (
            id,
            run_id,
            step_key,
            kind,
            step_seq,
            attempt,
            status,
            context_before,
            input,
            output,
            completed_at
          ) VALUES (
            $1,
            $2,
            'step-1',
            'forward',
            1,
            1,
            'completed',
            '{}'::jsonb,
            '{}'::jsonb,
            '{"ok":true}'::jsonb,
            now()
          )
        `,
        [attemptId, sourceRunId]
      )
      await client.query(
        `
          UPDATE workflow_runs
          SET branched_from_run_id = $1,
              branched_from_attempt_id = $2
          WHERE id = $3
        `,
        [sourceRunId, attemptId, branchedRunId]
      )
      await client.query(
        `
          INSERT INTO workflow_events (run_id, step_key, event_type, payload)
          VALUES ($1, 'step-1', 'step.completed', '{"ok":true}'::jsonb)
        `,
        [sourceRunId]
      )

      await client.query(upSql)

      const upgradedRunLookup = await client.query<{
        branched_from_attempt_run_id: string | null
      }>(
        `
          SELECT branched_from_attempt_run_id::text AS "branched_from_attempt_run_id"
          FROM workflow_runs
          WHERE id = $1
        `,
        [branchedRunId]
      )
      const upgradedRelationKinds = await client.query<{
        relkind: string
        table_name: string
      }>(
        `
          SELECT
            table_name AS "table_name",
            relkind
          FROM (
            VALUES ('workflow_step_attempts'), ('workflow_events')
          ) AS targets(table_name)
          JOIN pg_class ON pg_class.oid = (quote_ident(table_name))::regclass
        `
      )

      expect(upgradedRunLookup.rows[0]?.branched_from_attempt_run_id).toBe(sourceRunId)
      expect(upgradedRelationKinds.rows).toEqual([
        { table_name: "workflow_step_attempts", relkind: "p" },
        { table_name: "workflow_events", relkind: "p" },
      ])

      await client.query(downSql)

      const downgradedRelationKinds = await client.query<{
        has_attempt_run_id: boolean
        relkind: string
        table_name: string
      }>(
        `
          SELECT
            targets.table_name AS "table_name",
            pg_class.relkind,
            EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_schema = current_schema()
                AND table_name = 'workflow_runs'
                AND column_name = 'branched_from_attempt_run_id'
            ) AS "has_attempt_run_id"
          FROM (
            VALUES ('workflow_step_attempts'), ('workflow_events')
          ) AS targets(table_name)
          JOIN pg_class ON pg_class.oid = (quote_ident(targets.table_name))::regclass
        `
      )
      const downgradedConstraintLookup = await client.query<{ key_count: number }>(
        `
          SELECT cardinality(conkey) AS key_count
          FROM pg_constraint
          WHERE conname = 'workflow_runs_branched_from_attempt_fkey'
        `
      )

      expect(downgradedRelationKinds.rows).toEqual([
        {
          table_name: "workflow_step_attempts",
          relkind: "r",
          has_attempt_run_id: true,
        },
        {
          table_name: "workflow_events",
          relkind: "r",
          has_attempt_run_id: true,
        },
      ])
      expect(downgradedConstraintLookup.rows[0]?.key_count).toBe(2)
    } finally {
      await client.query("RESET search_path")
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
      client.release()
    }
  })

  it("stores history tables as run-hash partitions and prunes hot queries", async () => {
    const partitionLookup = await pool.query<{
      child_count: string
      relkind: string
      table_name: string
    }>(
      `
        SELECT
          table_name AS "table_name",
          relkind,
          (
            SELECT COUNT(*)::text
            FROM pg_inherits
            WHERE inhparent = (quote_ident(table_name))::regclass
          ) AS "child_count"
        FROM (
          VALUES ('workflow_step_attempts'), ('workflow_events')
        ) AS targets(table_name)
        JOIN pg_class ON pg_class.oid = (quote_ident(table_name))::regclass
      `
    )

    expect(partitionLookup.rows).toEqual([
      {
        table_name: "workflow_step_attempts",
        relkind: "p",
        child_count: "16",
      },
      {
        table_name: "workflow_events",
        relkind: "p",
        child_count: "16",
      },
    ])

    const seededRunRow = (
      await pool.query<{ runId: string }>(
        `
          WITH seeded_runs AS (
            INSERT INTO workflow_runs (
              id,
              definition_name,
              definition_version,
              task_queue,
              priority,
              status,
              current_step_key,
              input,
              context,
              available_at,
              completed_at
            )
            SELECT
              gen_random_uuid(),
              'partition-bulk',
              1,
              'default',
              0,
              'completed',
              NULL,
              '{}'::jsonb,
              '{}'::jsonb,
              now(),
              now()
            FROM generate_series(1, 1000)
            RETURNING id
          ), numbered_runs AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS seq
            FROM seeded_runs
          ), seeded_attempts AS (
            INSERT INTO workflow_step_attempts (
              id,
              run_id,
              step_key,
              kind,
              step_seq,
              attempt,
              status,
              context_before,
              input,
              output,
              started_at,
              completed_at,
              created_at,
              updated_at
            )
            SELECT
              gen_random_uuid(),
              numbered_runs.id,
              'step-' || step_seq,
              'forward',
              step_seq,
              1,
              'completed',
              '{}'::jsonb,
              '{}'::jsonb,
              jsonb_build_object('ok', true),
              now(),
              now(),
              now(),
              now()
            FROM numbered_runs
            CROSS JOIN generate_series(1, 10) AS step_seq
          ), seeded_events AS (
            INSERT INTO workflow_events (
              run_id,
              step_key,
              event_type,
              payload,
              created_at
            )
            SELECT
              numbered_runs.id,
              'step-' || event_seq,
              'step.completed',
              '{}'::jsonb,
              now()
            FROM numbered_runs
            CROSS JOIN generate_series(1, 10) AS event_seq
          )
          SELECT id AS "runId"
          FROM numbered_runs
          WHERE seq = 1
        `
      )
    ).rows[0]

    if (!seededRunRow) {
      throw new Error("Failed to seed a partition pruning test run")
    }

    const { runId } = seededRunRow

    const attemptPlanResult = await pool.query<{
      "QUERY PLAN": Array<Record<string, unknown>>
    }>(
      `
        EXPLAIN (FORMAT JSON)
        SELECT *
        FROM workflow_step_attempts
        WHERE run_id = $1
        ORDER BY step_seq ASC, attempt ASC, created_at ASC
      `,
      [runId]
    )
    const eventPlanResult = await pool.query<{
      "QUERY PLAN": Array<Record<string, unknown>>
    }>(
      `
        EXPLAIN (FORMAT JSON)
        SELECT *
        FROM workflow_events
        WHERE run_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [runId]
    )

    const attemptRelations = collectPlanRelationNames(
      getExplainPlanRoot(attemptPlanResult.rows[0]?.["QUERY PLAN"])
    ).filter((name) => name.startsWith("workflow_step_attempts_p"))
    const eventRelations = collectPlanRelationNames(
      getExplainPlanRoot(eventPlanResult.rows[0]?.["QUERY PLAN"])
    ).filter((name) => name.startsWith("workflow_events_p"))

    expect(new Set(attemptRelations).size).toBe(1)
    expect(new Set(eventRelations).size).toBe(1)
  })
})
