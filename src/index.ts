import { createApp } from "./app.js"
import { getConfig } from "./lib/config.js"
import { createDatabase } from "./lib/db.js"
import { createMetrics } from "./lib/metrics.js"
import { startWorkerLoop } from "./lib/worker.js"
import { createWorkflowEngine } from "./lib/workflow-engine.js"
import { createWorkflowStore } from "./lib/workflow-store.js"
import { workflows } from "./workflows/index.js"

const main = async () => {
  const config = getConfig()
  const sql = createDatabase(config)
  const metrics = createMetrics()
  const store = createWorkflowStore(sql)
  const engine = createWorkflowEngine({
    definitions: workflows,
    metrics,
    store,
  })
  const app = createApp({ engine, metrics, store })

  const stopWorker = startWorkerLoop({
    engine,
    workerId: config.HIPPO_WORKER_ID,
    pollIntervalMs: config.HIPPO_POLL_INTERVAL_MS,
    leaseMs: config.HIPPO_LEASE_MS,
    onError: (error) => {
      app.log.error(error)
    },
  })

  const shutdown = async () => {
    stopWorker()
    await app.close()
    await sql.end()
  }

  process.on("SIGINT", () => {
    void shutdown()
  })

  process.on("SIGTERM", () => {
    void shutdown()
  })

  await app.listen({
    host: config.HIPPO_HOST,
    port: config.HIPPO_PORT,
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
