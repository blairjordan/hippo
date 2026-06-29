import { Command } from "commander"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { runMigrations } from "./lib/migration-runner.js"
import { renderWorkflowAsMermaid } from "./lib/workflow-definition.js"
import { loadWorkflowDefinitions } from "./lib/workflow-loader.js"
import { createApp } from "./app.js"
import {
  createApiAuthenticator,
  createCallbackAuthenticator,
} from "./lib/auth.js"
import { getConfig } from "./lib/config.js"
import { createDatabase } from "./lib/db.js"
import { createMetrics } from "./lib/metrics.js"
import { createWorkflowNotifier } from "./lib/notifier.js"
import { startOutboxLoop } from "./lib/outbox.js"
import { startRecoveryLoop } from "./lib/recovery.js"
import { startScheduleLoop } from "./lib/scheduler.js"
import { createHippoTracer } from "./lib/tracing.js"
import { startWorkerLoop } from "./lib/worker.js"
import { createWorkflowEngine } from "./lib/workflow-engine.js"
import { createWorkflowStore } from "./lib/workflow-store.js"

const program = new Command()
program
  .name("hippo")
  .description("Hippo command-line interface")
  .version("0.1.0")

// Command: migrate
program
  .command("migrate")
  .description("Apply database migrations to Postgres")
  .option("--database-url <url>", "PostgreSQL connection URL")
  .action(async (options) => {
    const databaseUrl = options.databaseUrl || process.env.DATABASE_URL
    if (!databaseUrl) {
      console.error("Error: Database URL is required. Provide --database-url or set DATABASE_URL.")
      process.exit(1)
    }
    try {
      await runMigrations(databaseUrl)
      console.log("Migrations applied successfully.")
    } catch (error) {
      console.error("Migration failed:", error)
      process.exit(1)
    }
  })

// Command: render
program
  .command("render <workflowName>")
  .description("Render a workflow definition as Mermaid diagram")
  .option("--workflows <path>", "Path to the workflows index file", "./dist/src/workflows/index.js")
  .action(async (workflowName, options) => {
    const workflowsPath = path.resolve(process.cwd(), options.workflows)
    const moduleUrl = pathToFileURL(workflowsPath)
    try {
      const definitions = await loadWorkflowDefinitions(moduleUrl)
      const definition = definitions.find((d) => d.name === workflowName)
      if (!definition) {
        console.error(`Error: Workflow "${workflowName}" not found in ${workflowsPath}`)
        process.exit(1)
      }
      console.log(renderWorkflowAsMermaid(definition))
    } catch (error) {
      console.error("Failed to render workflow:", error)
      process.exit(1)
    }
  })

// Shared runner helpers
const parseTaskQueues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const bootstrapEngine = async (workflowsPath: string) => {
  const config = getConfig()
  const moduleUrl = pathToFileURL(path.resolve(process.cwd(), workflowsPath))
  const workflowDefinitions = await loadWorkflowDefinitions(moduleUrl)
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

// Command: worker
program
  .command("worker")
  .description("Start background execution loops (worker, scheduler, recovery, outbox)")
  .option("--workflows <path>", "Path to the workflows index file", "./dist/src/workflows/index.js")
  .action(async (options) => {
    try {
      const { config, sql, metrics, tracer, notifier, store, engine } = await bootstrapEngine(options.workflows)

      console.log("Starting Hippo worker loops...")
      const stopWorker = startWorkerLoop({
        engine,
        workerId: config.HIPPO_WORKER_ID,
        taskQueues: parseTaskQueues(config.HIPPO_TASK_QUEUES),
        pollIntervalMs: config.HIPPO_POLL_INTERVAL_MS,
        leaseMs: config.HIPPO_LEASE_MS,
        listenForWakeups: (onWake) => notifier.listen(() => onWake()),
        onError: (error) => console.error("Worker error:", error),
        tracer,
      })

      const stopRecovery = startRecoveryLoop({
        intervalMs: config.HIPPO_RECOVERY_INTERVAL_MS,
        limit: 100,
        metrics,
        onError: (error) => console.error("Recovery error:", error),
        store,
        tracer,
      })

      const stopScheduler = startScheduleLoop({
        engine,
        intervalMs: config.HIPPO_SCHEDULE_INTERVAL_MS,
        limit: 100,
        onError: (error) => console.error("Scheduler error:", error),
        store,
        tracer,
      })

      const stopOutbox = startOutboxLoop({
        handlers: {},
        intervalMs: config.HIPPO_OUTBOX_INTERVAL_MS,
        limit: 100,
        onError: (error, record) => console.error("Outbox error:", error, record),
        store,
        tracer,
      })

      const shutdown = async () => {
        console.log("Shutting down worker loops...")
        await stopWorker()
        await stopRecovery()
        await stopScheduler()
        await stopOutbox()
        await sql.end()
        process.exit(0)
      }

      process.on("SIGINT", () => void shutdown())
      process.on("SIGTERM", () => void shutdown())
    } catch (error) {
      console.error("Worker bootstrap failed:", error)
      process.exit(1)
    }
  })

// Command: server
program
  .command("server")
  .description("Start the API server, dashboard, and background loops")
  .option("--workflows <path>", "Path to the workflows index file", "./dist/src/workflows/index.js")
  .action(async (options) => {
    try {
      const { config, sql, metrics, tracer, notifier, store, engine } = await bootstrapEngine(options.workflows)

      console.log("Starting Hippo API server & worker loops...")
      const auth = {
        verifyApiRequest: createApiAuthenticator(config.HIPPO_API_TOKEN),
        verifyCallbackRequest: createCallbackAuthenticator({
          secret: config.HIPPO_CALLBACK_SECRET,
          toleranceSeconds: config.HIPPO_CALLBACK_TOLERANCE_SECONDS,
        }),
      }

      const app = createApp({
        auth,
        engine,
        listenForNotifications: notifier.listen,
        metrics,
        store,
        tracer,
      })

      const stopWorker = startWorkerLoop({
        engine,
        workerId: config.HIPPO_WORKER_ID,
        taskQueues: parseTaskQueues(config.HIPPO_TASK_QUEUES),
        pollIntervalMs: config.HIPPO_POLL_INTERVAL_MS,
        leaseMs: config.HIPPO_LEASE_MS,
        listenForWakeups: (onWake) => notifier.listen(() => onWake()),
        onError: (error) => app.log.error(error),
        tracer,
      })

      const stopRecovery = startRecoveryLoop({
        intervalMs: config.HIPPO_RECOVERY_INTERVAL_MS,
        limit: 100,
        metrics,
        onError: (error) => app.log.error(error),
        store,
        tracer,
      })

      const stopScheduler = startScheduleLoop({
        engine,
        intervalMs: config.HIPPO_SCHEDULE_INTERVAL_MS,
        limit: 100,
        onError: (error) => app.log.error(error),
        store,
        tracer,
      })

      const stopOutbox = startOutboxLoop({
        handlers: {},
        intervalMs: config.HIPPO_OUTBOX_INTERVAL_MS,
        limit: 100,
        onError: (error, record) => app.log.error({ error, record }),
        store,
        tracer,
      })

      const shutdown = async () => {
        console.log("Shutting down Hippo API server & worker loops...")
        await stopWorker()
        await stopRecovery()
        await stopScheduler()
        await stopOutbox()
        await app.close()
        await sql.end()
        process.exit(0)
      }

      process.on("SIGINT", () => void shutdown())
      process.on("SIGTERM", () => void shutdown())

      await app.listen({
        host: config.HIPPO_HOST,
        port: config.HIPPO_PORT,
      })
    } catch (error) {
      console.error("Server bootstrap failed:", error)
      process.exit(1)
    }
  })

// Bootstrap store helper for CLI operations
const bootstrapStore = async () => {
  const config = getConfig()
  const sql = createDatabase(config)
  const tracer = createHippoTracer()
  const store = createWorkflowStore(sql, { tracer })
  return { sql, store }
}

// Command Group: runs
const runsCmd = program
  .command("runs")
  .description("Manage and query workflow runs")

runsCmd
  .command("list")
  .alias("ls")
  .description("List workflow runs with optional filters")
  .option("--limit <number>", "Maximum number of runs to list", "50")
  .option("--status <status>", "Filter runs by status")
  .option("--workflow <name>", "Filter runs by workflow name")
  .option("--search <query>", "Search query for run ID, definition name or step key")
  .action(async (options) => {
    try {
      const { sql, store } = await bootstrapStore()
      const runs = await store.listRunsPaginated({
        limit: parseInt(options.limit, 10),
        ...(options.status ? { statuses: [options.status] } : {}),
        ...(options.workflow ? { workflowName: options.workflow } : {}),
        ...(options.search ? { search: options.search } : {}),
      })

      if (runs.length === 0) {
        console.log("No runs found.")
      } else {
        console.log(
          "RUN ID".padEnd(36) + " | " +
          "WORKFLOW".padEnd(20) + " | " +
          "STATUS".padEnd(10) + " | " +
          "CURRENT STEP".padEnd(20) + " | " +
          "UPDATED AT"
        )
        console.log("-".repeat(105))
        for (const run of runs) {
          console.log(
            run.id + " | " +
            (run.definitionName || "").padEnd(20).slice(0, 20) + " | " +
            run.status.padEnd(10) + " | " +
            (run.currentStepKey || "done").padEnd(20).slice(0, 20) + " | " +
            run.updatedAt.toLocaleString()
          )
        }
      }
      await sql.end()
    } catch (error) {
      console.error("Failed to list runs:", error)
      process.exit(1)
    }
  })

runsCmd
  .command("show <runId>")
  .description("Inspect a specific workflow run in detail")
  .action(async (runId) => {
    try {
      const { sql, store } = await bootstrapStore()
      const run = await store.getRun(runId)
      if (!run) {
        console.error(`Error: Run "${runId}" not found.`)
        await sql.end()
        process.exit(1)
      }

      console.log(`Run Details:`)
      console.log(`  ID:                 ${run.id}`)
      console.log(`  Workflow:           ${run.definitionName} (v${run.definitionVersion})`)
      console.log(`  Status:             ${run.status}`)
      console.log(`  Task Queue:         ${run.taskQueue}`)
      console.log(`  Priority:           ${run.priority}`)
      console.log(`  Current Step:       ${run.currentStepKey ?? "Completed"}`)
      console.log(`  Lease Owner:        ${run.leaseOwner ?? "None"}`)
      console.log(`  Lease Expires:      ${run.leaseExpiresAt ? run.leaseExpiresAt.toLocaleString() : "N/A"}`)
      console.log(`  Available At:       ${run.availableAt.toLocaleString()}`)
      console.log(`  Created At:         ${run.createdAt.toLocaleString()}`)
      console.log(`  Updated At:         ${run.updatedAt.toLocaleString()}`)
      if (run.completedAt) {
        console.log(`  Completed At:       ${run.completedAt.toLocaleString()}`)
      }
      if (run.parentRunId) {
        console.log(`  Parent Run ID:      ${run.parentRunId} (Step: ${run.parentStepKey})`)
      }
      if (run.traceContext) {
        console.log(`  Trace Context:      ${run.traceContext}`)
      }

      console.log(`\nInput:`)
      console.log(JSON.stringify(run.input, null, 2))

      console.log(`\nContext:`)
      console.log(JSON.stringify(run.context, null, 2))

      if (run.result) {
        console.log(`\nResult:`)
        console.log(JSON.stringify(run.result, null, 2))
      }

      if (run.error) {
        console.log(`\nError:`)
        console.log(JSON.stringify(run.error, null, 2))
      }

      const attempts = await store.getRunAttempts(runId)
      if (attempts.length > 0) {
        console.log(`\nStep Attempts:`)
        console.log(
          "  STEP".padEnd(25) + " | " +
          "KIND".padEnd(12) + " | " +
          "ATTEMPT".padEnd(8) + " | " +
          "STATUS".padEnd(10) + " | " +
          "COMPLETED AT"
        )
        console.log("  " + "-".repeat(70))
        for (const att of attempts) {
          console.log(
            "  " + (att.stepKey || "").padEnd(23).slice(0, 23) + " | " +
            att.kind.padEnd(10) + " | " +
            String(att.attempt).padEnd(6) + " | " +
            att.status.padEnd(8) + " | " +
            (att.completedAt ? att.completedAt.toLocaleString() : "in-progress")
          )
        }
      }

      await sql.end()
    } catch (error) {
      console.error("Failed to inspect run:", error)
      process.exit(1)
    }
  })

runsCmd
  .command("cancel <runId>")
  .description("Request cancellation of a workflow run")
  .option("--mode <mode>", "Cancel mode: graceful or hard", "graceful")
  .action(async (runId, options) => {
    try {
      const { sql, store } = await bootstrapStore()
      const run = await store.getRun(runId)
      if (!run) {
        console.error(`Error: Run "${runId}" not found.`)
        await sql.end()
        process.exit(1)
      }

      const mode = options.mode === "hard" ? "hard" : "graceful"
      await store.requestCancelRun({ runId, mode })
      console.log(`Cancellation request ('${mode}') submitted for run ${runId}.`)
      await sql.end()
    } catch (error) {
      console.error("Failed to cancel run:", error)
      process.exit(1)
    }
  })

// Command Group: workflows
const workflowsCmd = program
  .command("workflows")
  .description("Query and render workflows")

workflowsCmd
  .command("list")
  .alias("ls")
  .description("List all loaded workflow definitions")
  .option("--workflows <path>", "Path to the workflows index file", "./dist/src/workflows/index.js")
  .action(async (options) => {
    try {
      const workflowsPath = path.resolve(process.cwd(), options.workflows)
      const moduleUrl = pathToFileURL(workflowsPath)
      const definitions = await loadWorkflowDefinitions(moduleUrl)
      if (definitions.length === 0) {
        console.log("No workflows registered.")
      } else {
        console.log("Registered Workflows:")
        for (const def of definitions) {
          console.log(`- ${def.name} (version: ${def.version})${def.title ? `: ${def.title}` : ""}`)
        }
      }
    } catch (error) {
      console.error("Failed to list workflows:", error)
      process.exit(1)
    }
  })

workflowsCmd
  .command("render <workflowName>")
  .description("Render a workflow definition as Mermaid diagram")
  .option("--workflows <path>", "Path to the workflows index file", "./dist/src/workflows/index.js")
  .action(async (workflowName, options) => {
    const workflowsPath = path.resolve(process.cwd(), options.workflows)
    const moduleUrl = pathToFileURL(workflowsPath)
    try {
      const definitions = await loadWorkflowDefinitions(moduleUrl)
      const definition = definitions.find((d) => d.name === workflowName)
      if (!definition) {
        console.error(`Error: Workflow "${workflowName}" not found in ${workflowsPath}`)
        process.exit(1)
      }
      console.log(renderWorkflowAsMermaid(definition))
    } catch (error) {
      console.error("Failed to render workflow:", error)
      process.exit(1)
    }
  })

program.parse(process.argv)
