import type { HippoAuth } from "./lib/auth.js"
import Fastify from "fastify"
import sensible from "@fastify/sensible"

import type { HippoMetrics } from "./lib/metrics.js"
import type { WorkflowNotification } from "./lib/notifier.js"
import { createHippoTracer, type HippoTracer } from "./lib/tracing.js"
import type { WorkflowEngine } from "./lib/workflow-engine.js"
import type { WorkflowStore } from "./lib/workflow-store.js"
import { createHealthRoutes } from "./routes/health.js"
import { createMetricsRoutes } from "./routes/metrics.js"
import { createHumanTaskRoutes } from "./routes/human-tasks.js"
import { createWorkflowRoutes } from "./routes/workflows.js"

export const createApp = (args: {
  auth: HippoAuth
  callbackSecret?: string
  callbackToleranceSeconds?: number
  engine: WorkflowEngine
  externalHeartbeatLeaseMs?: number
  listenForNotifications?: (
    onNotification: (notification: WorkflowNotification) => void
  ) => Promise<() => Promise<void>>
  metrics: HippoMetrics
  store: WorkflowStore
  tracer?: HippoTracer
}) => {
  const app = Fastify({
    logger: true,
  })
  const tracer = args.tracer ?? createHippoTracer()

  void app.register(sensible)
  void app.register(createHealthRoutes(args.store.ping))
  void app.register(createMetricsRoutes(args.metrics, args.auth.verifyApiRequest))
  void app.register(
    createHumanTaskRoutes({
      callbackToleranceSeconds: args.callbackToleranceSeconds ?? 300,
      engine: args.engine,
      tracer,
      ...(args.callbackSecret === undefined
        ? {}
        : { callbackSecret: args.callbackSecret }),
    })
  )
  void app.register(
    createWorkflowRoutes({
      auth: args.auth,
      engine: args.engine,
      externalHeartbeatLeaseMs: args.externalHeartbeatLeaseMs ?? 15_000,
      metrics: args.metrics,
      store: args.store,
      tracer,
      ...(args.listenForNotifications === undefined
        ? {}
        : { listenForNotifications: args.listenForNotifications }),
    })
  )

  return app
}
