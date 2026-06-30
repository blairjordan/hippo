import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { createApp } from "../app.js"
import { createApiAuthenticator, createCallbackAuthenticator } from "./auth.js"
import { getConfig, type HippoConfig } from "./config.js"
import { createDatabase } from "./db.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowNotifier } from "./notifier.js"
import { startOutboxLoop } from "./outbox.js"
import { servesHttp, runsBackgroundLoops, type HippoProcessRole } from "./process-role.js"
import { startRecoveryLoop } from "./recovery.js"
import { startScheduleLoop } from "./scheduler.js"
import { createHippoTracer, registerOtelFromEnv } from "./tracing.js"
import {
  loadWorkflowDefinitions,
  startWorkflowDevReloader,
  workflowModulePath,
} from "./workflow-loader.js"
import { startWorkerLoop } from "./worker.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import { createWorkflowStore } from "./workflow-store.js"

export type HippoProcessLogger = {
  info: (message: string) => void
  error: (message: string, error?: unknown) => void
}

const parseTaskQueues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const resolveWorkflowModuleUrl = (input?: string | URL) => {
  if (input instanceof URL) {
    return input
  }

  if (typeof input === "string") {
    return pathToFileURL(path.resolve(process.cwd(), input))
  }

  return workflowModulePath()
}

export const runHippoProcessRole = async (args: {
  role: HippoProcessRole
  config?: HippoConfig
  workflowsPath?: string | URL
  logger?: HippoProcessLogger
}) => {
  const config = args.config ?? getConfig()
  const logger = args.logger ?? {
    info: (message: string) => console.log(message),
    error: (message: string, error?: unknown) => console.error(message, error),
  }
  const workflowDefinitions = await loadWorkflowDefinitions(
    resolveWorkflowModuleUrl(args.workflowsPath)
  )
  const publicBaseUrl =
    config.HIPPO_PUBLIC_BASE_URL ??
    `http://${config.HIPPO_HOST}:${String(config.HIPPO_PORT)}`
  const sql = createDatabase(config)
  const metrics = createMetrics()
  const stopTracing = registerOtelFromEnv({ env: process.env })
  const tracer = createHippoTracer()
  const notifier = createWorkflowNotifier(config)
  const store = createWorkflowStore(sql, {
    notifyRunnable: () => notifier.notifyRunnable(),
    notifyRunEvent: (runId) => notifier.notifyRunEvent(runId),
    tracer,
  })
  const engine = createWorkflowEngine({
    definitions: workflowDefinitions,
    humanTasks: {
      baseUrl: publicBaseUrl,
      toleranceSeconds: config.HIPPO_CALLBACK_TOLERANCE_SECONDS,
      ...(config.HIPPO_CALLBACK_SECRET === undefined
        ? {}
        : { secret: config.HIPPO_CALLBACK_SECRET }),
    },
    metrics,
    store,
    tracer,
  })
  const stopWorkflowReload =
    config.HIPPO_ENV === "dev"
      ? await startWorkflowDevReloader({
          engine,
          logger: console,
          modulePath: resolveWorkflowModuleUrl(args.workflowsPath),
        })
      : async () => undefined

  let stopServer: () => Promise<void> = async () => {}
  let stopWorker: () => Promise<void> = async () => {}
  let stopRecovery: () => Promise<void> = async () => {}
  let stopScheduler: () => Promise<void> = async () => {}
  let stopOutbox: () => Promise<void> = async () => {}

  if (servesHttp(args.role)) {
    const app = createApp({
      auth: {
        verifyApiRequest: createApiAuthenticator(config.HIPPO_API_TOKEN),
        verifyCallbackRequest: createCallbackAuthenticator({
          secret: config.HIPPO_CALLBACK_SECRET,
          toleranceSeconds: config.HIPPO_CALLBACK_TOLERANCE_SECONDS,
        }),
      },
      callbackToleranceSeconds: config.HIPPO_CALLBACK_TOLERANCE_SECONDS,
      engine,
      externalHeartbeatLeaseMs: config.HIPPO_LEASE_MS,
      listenForNotifications: notifier.listen,
      metrics,
      store,
      tracer,
      ...(config.HIPPO_CALLBACK_SECRET === undefined
        ? {}
        : { callbackSecret: config.HIPPO_CALLBACK_SECRET }),
    })

    stopServer = async () => {
      await app.close()
    }

    await app.listen({
      host: config.HIPPO_HOST,
      port: config.HIPPO_PORT,
    })
    logger.info(
      `Hippo HTTP server listening on ${config.HIPPO_HOST}:${String(config.HIPPO_PORT)}`
    )
  }

  if (runsBackgroundLoops(args.role)) {
    stopWorker = startWorkerLoop({
      engine,
      workerId: config.HIPPO_WORKER_ID,
      taskQueues: parseTaskQueues(config.HIPPO_TASK_QUEUES),
      pollIntervalMs: config.HIPPO_POLL_INTERVAL_MS,
      leaseMs: config.HIPPO_LEASE_MS,
      listenForWakeups: (onWake) => notifier.listen(() => onWake()),
      onError: (error) => logger.error("Worker error:", error),
      tracer,
    })
    stopRecovery = startRecoveryLoop({
      intervalMs: config.HIPPO_RECOVERY_INTERVAL_MS,
      limit: 100,
      metrics,
      onError: (error) => logger.error("Recovery error:", error),
      store,
      tracer,
    })
    stopScheduler = startScheduleLoop({
      engine,
      intervalMs: config.HIPPO_SCHEDULE_INTERVAL_MS,
      limit: 100,
      onError: (error) => logger.error("Scheduler error:", error),
      store,
      tracer,
    })
    stopOutbox = startOutboxLoop({
      handlers: {},
      intervalMs: config.HIPPO_OUTBOX_INTERVAL_MS,
      limit: 100,
      onError: (error, record) =>
        logger.error(
          `Outbox error${record ? ` for record ${record.id}` : ""}:`,
          error
        ),
      store,
      tracer,
    })
    logger.info(`Hippo background loops started in '${args.role}' role`)
  }

  let shuttingDown = false
  const shutdown = async () => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    await stopWorkflowReload()
    await stopWorker()
    await stopRecovery()
    await stopScheduler()
    await stopOutbox()
    await stopServer()
    await sql.end()
    await stopTracing()
  }

  process.on("SIGINT", () => {
    void shutdown()
  })
  process.on("SIGTERM", () => {
    void shutdown()
  })

  return { shutdown }
}
