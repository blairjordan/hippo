import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll } from "vitest"
import { Pool } from "pg"
import { trace, propagation, context } from "@opentelemetry/api"
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks"
import { W3CTraceContextPropagator } from "@opentelemetry/core"
import { BasicTracerProvider, SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base"
import { createWorkflowEngine } from "./workflow-engine.js"
import { createWorkflowStore } from "./workflow-store.js"

export const testDatabaseUrl = process.env.HIPPO_PG_TEST_URL
export const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../db/migrations"
)

export const drainEngine = async (
  engine: ReturnType<typeof createWorkflowEngine>,
  maxTicks = 1_000
) => {
  for (let index = 0; index < maxTicks; index += 1) {
    const result = await engine.tick("pg-test-worker", 15_000)

    if (!result) {
      return
    }
  }

  throw new Error("Engine did not drain within maxTicks")
}

export const collectPlanRelationNames = (node: unknown): string[] => {
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

export const getExplainPlanRoot = (value: unknown): unknown => {
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

export const readMigrationSection = async (
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

export const setupTestDatabase = () => {
  const databaseName = `hippo_test_${randomUUID().replaceAll("-", "_")}`
  const baseUrl = new URL(
    testDatabaseUrl ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres"
  )
  const adminUrl = new URL(baseUrl.toString())
  adminUrl.pathname = "/postgres"

  let pool: Pool
  let store: ReturnType<typeof createWorkflowStore>

  beforeAll(async () => {
    const contextManager = new AsyncHooksContextManager()
    contextManager.enable()
    try {
      context.setGlobalContextManager(contextManager)
    } catch {
      // ignore if already registered
    }

    const provider = new BasicTracerProvider({
      spanProcessors: [
        new SimpleSpanProcessor(new InMemorySpanExporter())
      ]
    })
    try {
      trace.setGlobalTracerProvider(provider)
    } catch {
      // ignore if already registered
    }
    try {
      propagation.setGlobalPropagator(new W3CTraceContextPropagator())
    } catch {
      // ignore if already registered
    }

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
    if (pool) {
      await pool.end()
    }

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

  return {
    getPool: () => pool,
    getStore: () => store,
  }
}
