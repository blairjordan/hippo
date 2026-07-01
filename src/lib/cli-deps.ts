import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { getConfig, type HippoConfig } from "./config.js"
import { createDatabase } from "./db.js"
import { runMigrations } from "./migration-runner.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowNotifier } from "./notifier.js"
import { runHippoProcessRole } from "./process-runtime.js"
import { createHippoTracer } from "./tracing.js"
import { renderWorkflowAsMermaid } from "./workflow-definition.js"
import { loadWorkflowDefinitions } from "./workflow-loader.js"
import { createWorkflowEngine, type WorkflowEngine } from "./workflow-engine.js"
import { createWorkflowStore, type WorkflowStore } from "./workflow-store.js"
import type { WorkflowDefinition } from "../types/workflow.js"
import type { HippoProcessRole } from "./process-role.js"

export type CliStore = Pick<
  WorkflowStore,
  | "getRun"
  | "getRunAttempts"
  | "listRunsPaginated"
  | "requestCancelRun"
  | "listSchedules"
  | "createSchedule"
  | "updateScheduleActive"
  | "deleteSchedule"
>

export type CliSql = {
  end: () => Promise<void>
}

export type CliBootstrapStore = () => Promise<{
  sql: CliSql
  store: CliStore
}>

export type CliBootstrapEngine = (workflowsPath: string) => Promise<{
  config: HippoConfig
  sql: CliSql
  metrics: ReturnType<typeof createMetrics>
  tracer: ReturnType<typeof createHippoTracer>
  notifier: ReturnType<typeof createWorkflowNotifier>
  store: WorkflowStore
  engine: WorkflowEngine
}>

export type CliDeps = {
  cwd: () => string
  env: Record<string, string | undefined>
  exit: (code: number) => never
  stderr: Pick<typeof console, "error">
  stdout: Pick<typeof console, "log">
  runMigrations: (databaseUrl: string) => Promise<void>
  loadWorkflowDefinitions: (modulePath: URL) => Promise<WorkflowDefinition[]>
  renderWorkflowAsMermaid: (definition: WorkflowDefinition) => string
  bootstrapEngine: CliBootstrapEngine
  bootstrapStore: CliBootstrapStore
  runProcessRole: (args: {
    role: HippoProcessRole
    workflowsPath: string
  }) => Promise<void>
}

export const defaultWorkflowPath = "./dist/src/workflows/index.js"

export const parseTaskQueues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

export const resolveWorkflowModuleUrl = (args: {
  cwd: string
  workflowsPath: string
}) => pathToFileURL(path.resolve(args.cwd, args.workflowsPath))

const createDefaultBootstrapEngine: CliBootstrapEngine = async (workflowsPath) => {
  const config = getConfig()
  const workflowDefinitions = await loadWorkflowDefinitions(
    resolveWorkflowModuleUrl({
      cwd: process.cwd(),
      workflowsPath,
    })
  )
  const sql = createDatabase(config)
  const metrics = createMetrics()
  const tracer = createHippoTracer()
  const notifier = createWorkflowNotifier(config)
  const store = createWorkflowStore(sql, {
    notifyRunnable: () => notifier.notifyRunnable(),
    notifyRunEvent: (runId) => notifier.notifyRunEvent(runId),
    tracer,
  })
  const engine = createWorkflowEngine({
    definitions: workflowDefinitions,
    metrics,
    store,
    tracer,
  })

  return { config, sql, metrics, tracer, notifier, store, engine }
}

const createDefaultBootstrapStore: CliBootstrapStore = async () => {
  const config = getConfig()
  const sql = createDatabase(config)
  const tracer = createHippoTracer()
  const store = createWorkflowStore(sql, { tracer })
  return { sql, store }
}

export const createDefaultCliDeps = (): CliDeps => ({
  cwd: () => process.cwd(),
  env: process.env,
  exit: (code) => process.exit(code),
  stderr: console,
  stdout: console,
  runMigrations,
  loadWorkflowDefinitions,
  renderWorkflowAsMermaid,
  bootstrapEngine: createDefaultBootstrapEngine,
  bootstrapStore: createDefaultBootstrapStore,
  runProcessRole: async ({ role, workflowsPath }) => {
    await runHippoProcessRole({ role, workflowsPath })
    return undefined
  },
})

export const closeSql = async (sql: CliSql) => {
  await sql.end()
}

export const runStoreCommand = async <T>(
  deps: CliDeps,
  action: (store: CliStore) => Promise<T>
) => {
  const { sql, store } = await deps.bootstrapStore()

  try {
    return await action(store)
  } finally {
    await closeSql(sql)
  }
}
