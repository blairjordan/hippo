import process from "node:process"

import {
  createDatabase,
  createMetrics,
  createHippoTracer,
  createWorkflowNotifier,
  createWorkflowStore,
  createWorkflowEngine,
} from "@hippo/core"

import {
  createApp,
  createApiAuthenticator,
  createCallbackAuthenticator,
  getConfig,
  startWorkerLoop,
  startRecoveryLoop,
  startScheduleLoop,
  startOutboxLoop,
} from "@hippo/server"

import { orderFulfillmentWorkflow } from "./workflows/order-fulfillment.js"
import { webhookCallbackWorkflow } from "./workflows/webhook-callback.js"
import { nightlyReportWorkflow } from "./workflows/nightly-report.js"
import { approvalFlowWorkflow } from "./workflows/approval-flow.js"

const parseTaskQueues = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const main = async () => {
  const config = getConfig()
  const workflowDefinitions = [
    orderFulfillmentWorkflow,
    webhookCallbackWorkflow,
    nightlyReportWorkflow,
    approvalFlowWorkflow,
  ]

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

  console.log("Starting Hippo examples background execution loops...")

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
    console.log("Stopping background execution loops and Fastify app...")
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

  console.log(`Hippo examples running at http://${config.HIPPO_HOST}:${String(config.HIPPO_PORT)}`)
}

main().catch((error) => {
  console.error("Hippo examples failed to start:", error)
  process.exitCode = 1
})
