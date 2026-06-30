import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import type { FastifyPluginAsync } from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../lib/workflow-definition.js"
import type { HippoAuth } from "../lib/auth.js"
import type { HippoMetrics } from "../lib/metrics.js"
import type { WorkflowNotification } from "../lib/notifier.js"
import { runRecoveryPass } from "../lib/recovery.js"
import { computeNextScheduleFireAt } from "../lib/scheduler.js"
import { createTraceAttributes, type HippoTracer } from "../lib/tracing.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import type { WorkflowEngine } from "../lib/workflow-engine.js"
import {
  BudgetExceededError,
  type WorkflowStore,
} from "../lib/workflow-store.js"
import {
  RUNS_PAGE_SIZE,
  createWorkflowStepActions,
  renderAttemptCard,
  renderDefinitionDetailDocument,
  renderDefinitionsIndexDocument,
  renderEventCard,
  renderLineageRunCard,
  renderRunDetailDocument,
  renderRunsIndexDocument,
  renderUsageCard,
  resolveStatusFilter,
} from "./dashboard.js"
import {
  cancelRunBodySchema,
  createScheduleBodySchema,
  externalHeartbeatBodySchema,
  externalSessionEventsBodySchema,
  externalSessionParamsSchema,
  forkRunBodySchema,
  jsonValueSchema,
  optionalQueryText,
  operatorListQuerySchema,
  operatorRunsQuerySchema,
  reconcileBodySchema,
  resumeBodySchema,
  rewindRunBodySchema,
  runContextQuerySchema,
  runIdParamsSchema,
  runStreamQuerySchema,
  signalParamsSchema,
  startRunBodySchema,
  stuckRunsQuerySchema,
  terminalRunStatuses,
  workflowNameParamsSchema,
  correlationKeyParamsSchema,
} from "./workflows/schemas.js"
import {
  compensateRunTree,
  createRouteTraceAttributes,
  getExistingRun,
  getIdempotencyKey,
  paginateRuns,
  projectRunContext,
  propagateCancellation,
  renderProjections,
  requireApiAuth,
  requireCallbackAuth,
  traceAuthedRequest,
  traceRawRequest,
} from "./workflows/helpers.js"
import { registerDashboardRoutes } from "./workflows/dashboard-routes.js"
import { registerOperatorRoutes } from "./workflows/operator-routes.js"
import { registerCallbackRoutes } from "./workflows/callback-routes.js"


export const createWorkflowRoutes = (args: {
  auth: HippoAuth
  engine: WorkflowEngine
  externalHeartbeatLeaseMs: number
  listenForNotifications?: (
    onNotification: (notification: WorkflowNotification) => void
  ) => Promise<() => Promise<void>>
  metrics: HippoMetrics
  store: WorkflowStore
  tracer: HippoTracer
}): FastifyPluginAsync => async (app) => {
  registerDashboardRoutes(app, args)
  registerOperatorRoutes(app, args)
  registerCallbackRoutes(app, args)

  app.post("/v1/workflows/:workflowName/runs", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.start_run",
        attributes: {
          ...createRouteTraceAttributes({
            method: request.method,
            operation: "http.start_run",
            route: "/v1/workflows/:workflowName/runs",
          }),
        },
      },
      run: async () => {
        const params = workflowNameParamsSchema.parse(request.params)
        const body = startRunBodySchema.parse(request.body ?? {})
        const idempotencyKey = getIdempotencyKey(request)

        if (!args.engine.hasWorkflow(params.workflowName)) {
          throw app.httpErrors.notFound(
            `Workflow "${params.workflowName}" is not registered`
          )
        }

        const run = await args.engine.startRun({
          workflowName: params.workflowName,
          payload: body.payload,
          taskQueue: body.taskQueue,
          priority: body.priority,
          ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        })

        reply.code(202)
        return {
          runId: run.id,
          status: run.status,
          currentStepKey: run.currentStepKey,
          taskQueue: run.taskQueue,
          priority: run.priority,
        }
      },
    })
  })


  app.post("/v1/runs/:runId/signals/:signalName", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.create_signal",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.create_signal",
          route: "/v1/runs/:runId/signals/:signalName",
        }),
      },
      run: async () => {
        const params = signalParamsSchema.parse(request.params)
        const body = z
          .object({
            payload: jsonValueSchema.optional(),
          })
          .parse(request.body ?? {})
        const runId = await args.store.createSignal({
          runId: params.runId,
          signalName: params.signalName,
          payload: body.payload ?? null,
        })

        if (!runId) {
          throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
        }

        reply.code(202)
        return {
          runId,
          signalName: params.signalName,
        }
      },
    })
  })

  app.get("/v1/runs/:runId", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.get_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.get_run",
          route: "/v1/runs/:runId",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const run = await args.store.getRun(params.runId)

        if (!run) {
          throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
        }

        const [events, attempts, lineage, usage] = await Promise.all([
          args.store.getRunEvents(run.id),
          args.store.getRunAttempts(run.id),
          args.store.listRunLineage(run.id),
          args.store.getRunUsage(run.id),
        ])

        const workflow = args.engine
          .listWorkflows()
          .find(
            (candidate) =>
              candidate.name === run.definitionName &&
              candidate.version === run.definitionVersion
          )
        const projections = renderProjections(workflow?.queries, run.context)

        return {
          run,
          attempts,
          events,
          lineage,
          usage,
          projections,
        }
      },
    })
  })

  app.get("/v1/runs/:runId/context", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.get_run_context",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.get_run_context",
          route: "/v1/runs/:runId/context",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const query = runContextQuerySchema.parse(request.query)
        const run = await getExistingRun(app, args.store, params.runId)
        const keys =
          query.keys
            ?.split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0) ?? []

        return {
          runId: run.id,
          workflowName: run.definitionName,
          context: projectRunContext(run.context, keys),
        }
      },
    })
  })

  app.get("/v1/runs/:runId/query/:queryName", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.query_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.query_run",
          route: "/v1/runs/:runId/query/:queryName",
        }),
      },
      run: async () => {
        const params = z
          .object({
            runId: z.uuid(),
            queryName: z.string().min(1),
          })
          .parse(request.params)

        const run = await getExistingRun(app, args.store, params.runId)
        const workflow = args.engine
          .listWorkflows()
          .find(
            (candidate) =>
              candidate.name === run.definitionName &&
              candidate.version === run.definitionVersion
          )

        if (!workflow) {
          throw app.httpErrors.notFound(
            `Workflow "${run.definitionName}" (v${run.definitionVersion}) not found`
          )
        }

        const queryFn = workflow.queries?.[params.queryName]
        if (!queryFn) {
          throw app.httpErrors.notFound(
            `Query "${params.queryName}" not defined on workflow "${run.definitionName}"`
          )
        }

        try {
          const result = queryFn(run.context)
          return {
            runId: run.id,
            workflowName: run.definitionName,
            queryName: params.queryName,
            result,
          }
        } catch (error) {
          throw app.httpErrors.badRequest(
            `Failed to execute query "${params.queryName}": ${error instanceof Error ? error.message : String(error)}`
          )
        }
      },
    })
  })

  app.get("/v1/runs/:runId/stream", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.stream_run_events",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.stream_run_events",
          route: "/v1/runs/:runId/stream",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const query = runStreamQuerySchema.parse(request.query)
        await getExistingRun(app, args.store, params.runId)

        reply.hijack()
        reply.raw.writeHead(200, {
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
          "content-type": "text/event-stream; charset=utf-8",
        })

        let active = true
        let lastEventId = Math.max(
          Number(request.headers["last-event-id"] ?? 0) || 0,
          query.afterEventId
        )
        let sending = false

        const sendPendingEvents = async (
          trigger: "initial" | "poll" | "notification"
        ) => {
          if (!active || sending) {
            return
          }

          sending = true

          try {
            await traceRawRequest(
              args.tracer,
              {
                name: "hippo.http.stream_run_events.flush",
                attributes: {
                  ...createTraceAttributes({
                    operation: "http.stream_run_events.flush",
                    runId: params.runId,
                  }),
                  "hippo.stream.trigger": trigger,
                },
              },
              async () => {
                const events = await args.store.getRunEvents(params.runId)

                for (const event of events) {
                  if (event.id <= lastEventId) {
                    continue
                  }

                  lastEventId = event.id
                  reply.raw.write(`id: ${String(event.id)}\n`)
                  reply.raw.write(`data: ${JSON.stringify({
                    ...event,
                    createdAt: event.createdAt.toISOString(),
                  })}\n\n`)
                }
              }
            )
          } finally {
            sending = false
          }
        }

        const heartbeat = setInterval(() => {
          if (active) {
            reply.raw.write(": keepalive\n\n")
          }
        }, 15_000)
        const poller = setInterval(() => {
          void sendPendingEvents("poll")
        }, 5_000)
        let stopListening: (() => Promise<void>) | null = null

        if (args.listenForNotifications) {
          try {
            stopListening = await args.listenForNotifications((notification) => {
              if (
                notification.kind === "run_event" &&
                notification.runId === params.runId
              ) {
                void sendPendingEvents("notification")
              }
            })
          } catch {
            stopListening = null
          }
        }

        await sendPendingEvents("initial")

        await new Promise<void>((resolve) => {
          reply.raw.on("close", () => {
            active = false
            clearInterval(heartbeat)
            clearInterval(poller)
            void stopListening?.()
            resolve()
          })
        })
      },
    })
  })

}
