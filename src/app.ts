import Fastify from "fastify"
import sensible from "@fastify/sensible"

import type { HippoMetrics } from "./lib/metrics.js"
import type { WorkflowEngine } from "./lib/workflow-engine.js"
import type { WorkflowStore } from "./lib/workflow-store.js"
import { createHealthRoutes } from "./routes/health.js"
import { createMetricsRoutes } from "./routes/metrics.js"
import { createWorkflowRoutes } from "./routes/workflows.js"

export const createApp = (args: {
  engine: WorkflowEngine
  metrics: HippoMetrics
  store: WorkflowStore
}) => {
  const app = Fastify({
    logger: true,
  })

  void app.register(sensible)
  void app.register(createHealthRoutes(args.store.ping))
  void app.register(createMetricsRoutes(args.metrics))
  void app.register(
    createWorkflowRoutes({ engine: args.engine, store: args.store })
  )

  return app
}
