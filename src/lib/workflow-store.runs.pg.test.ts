import { describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
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
import { createHippoTracer, getActiveTraceContext } from "./tracing.js"
import {
  drainEngine,
  collectPlanRelationNames,
  getExplainPlanRoot,
  readMigrationSection,
  setupTestDatabase,
  testDatabaseUrl,
} from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - runs", () => {
  const { getPool, getStore } = setupTestDatabase()

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
    const store = getStore()
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

  it("runs fan-out children and resumes the parent through the SQL store", async () => {
    const childWorkflow = defineWorkflow({
      name: "pg-fanout-child",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: ({ input }) => {
            if (input["shouldFail"] === true) {
              throw new Error(`pg-fanout-child-${String(input["index"])}`)
            }

            const index = input["index"]

            if (typeof index !== "number") {
              throw new Error("pg fan-out child index must be a number")
            }

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
      name: "pg-fanout-parent",
      version: 1,
      startAt: "spread",
      steps: {
        spread: fanOut({
          next: "done",
          failureMode: "collect",
          children: () => [
            { workflow: childWorkflow.name, input: { index: 0 } },
            { workflow: childWorkflow.name, input: { index: 1, shouldFail: true } },
            { workflow: childWorkflow.name, input: { index: 2 } },
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
    const store = getStore()
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
    expect(completedParent?.context.childStatuses).toEqual([
      "completed",
      "failed",
      "completed",
    ])
    expect(completedParent?.context.childIndexes).toEqual([0, null, 2])
    expect(childRuns).toHaveLength(3)
  })

  it("surfaces timed-out fan-out children to the parent join through the SQL store", async () => {
    const waitingChildWorkflow = defineWorkflow({
      name: "pg-fanout-timeout-child",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: (context) => ({
            correlationKey: `pg-fanout-hold:${context.run.id}`,
          }),
          resume: () => ({}),
        }),
        done: endStep(),
      },
    })
    const fastChildWorkflow = defineWorkflow({
      name: "pg-fanout-timeout-fast-child",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "pg-fanout-timeout-parent",
      version: 1,
      startAt: "spread",
      steps: {
        spread: fanOut({
          next: "done",
          timeoutMs: 1,
          children: () => [
            { workflow: fastChildWorkflow.name, input: { index: 0 } },
            { workflow: waitingChildWorkflow.name, input: { index: 1 } },
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
    const store = getStore()
    const engine = createWorkflowEngine({
      definitions: [parentWorkflow, fastChildWorkflow, waitingChildWorkflow],
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
      "canceled",
    ])
  })

  it("round-trips the partition migration from legacy tables without losing lineage", async () => {
    const pool = getPool()
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
          SELECT pool_constraint.key_count
          FROM (
            SELECT cardinality(conkey) AS key_count
            FROM pg_constraint
            WHERE conname = 'workflow_runs_branched_from_attempt_fkey'
          ) AS pool_constraint
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
    } finally {
      await client.query("RESET search_path")
      await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`)
      client.release()
    }
  })

  it("stores history tables as run-hash partitions and prunes hot queries", async () => {
    const pool = getPool()
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

  it("propagates and saves trace context recursively to child runs and step attempts", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "traceparent-propagation-example",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          run: async () => {
            return { patch: { done: true } }
          },
          next: "end",
        }),
        end: endStep(),
      },
    })

    const engine = createWorkflowEngine({
      definitions: [workflow],
      store,
      metrics: createMetrics(),
    })

    const tracer = createHippoTracer({ scopeName: "test-integration-tracing" })

    let runId!: string
    let parentTraceId!: string

    await tracer.withSpan({ name: "integration-parent-span" }, async () => {
      const activeTraceParent = getActiveTraceContext()
      expect(activeTraceParent).toBeDefined()
      parentTraceId = activeTraceParent!.split("-")[1]!

      const run = await engine.startRun({
        workflowName: "traceparent-propagation-example",
        payload: {},
        taskQueue: "test-tracing-queue",
      })
      runId = run.id

      const savedRun = await store.getRun(runId)
      expect(savedRun?.traceContext).toBeDefined()
      const savedTraceId = savedRun?.traceContext?.split("-")[1]
      expect(savedTraceId).toBe(parentTraceId)
    })

    for (let i = 0; i < 10; i++) {
      const result = await engine.tick("pg-test-worker", 15_000, ["test-tracing-queue"])
      if (!result) break
    }

    const attempts = await store.getRunAttempts(runId)
    expect(attempts.length).toBeGreaterThan(0)
    expect(attempts[0]?.traceContext).toBeDefined()
    expect(attempts[0]?.traceContext).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    const attemptTraceId = attempts[0]?.traceContext?.split("-")[1]
    expect(attemptTraceId).toBe(parentTraceId)
  })
})
