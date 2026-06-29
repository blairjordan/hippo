import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../lib/workflow-definition.js"
import type { HippoAuth } from "../lib/auth.js"
import type { HippoMetrics } from "../lib/metrics.js"
import type { WorkflowNotification } from "../lib/notifier.js"
import { runRecoveryPass } from "../lib/recovery.js"
import { computeNextScheduleFireAt } from "../lib/scheduler.js"
import {
  createTraceAttributes,
  type HippoTracer,
} from "../lib/tracing.js"
import type { WorkflowEngine } from "../lib/workflow-engine.js"
import { BudgetExceededError, type WorkflowStore } from "../lib/workflow-store.js"
import type { JsonObject, JsonValue } from "../types/json.js"
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

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema)

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const optionalQueryText = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).max(200).optional()
)

const startRunBodySchema = z.object({
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
})

const resumeBodySchema = z.object({
  payload: jsonValueSchema.optional(),
})

const externalHeartbeatBodySchema = z.object({
  progress: z.number().min(0).max(1).optional(),
  message: z.string().min(1).max(1_000).optional(),
  usage: z
    .object({
      resource: z.string().min(1),
      amount: z.number(),
      costUsd: z.number().optional(),
    })
    .optional(),
})

const externalSessionEventsBodySchema = z.object({
  events: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(200),
        data: jsonValueSchema,
      })
    )
    .min(1)
    .max(100),
})

const operatorListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
})

const operatorRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  parentRunId: z.uuid().optional(),
  search: optionalQueryText,
  status: z
    .enum([
      "queued",
      "running",
      "waiting",
      "completed",
      "failed",
      "compensation_failed",
      "exhausted_budget",
      "canceled",
    ])
    .optional(),
  taskQueue: optionalQueryText,
  workflowName: optionalQueryText,
  afterUpdatedAt: z.string().optional(),
  afterId: z.uuid().optional(),
})

const stuckRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  olderThanMs: z.coerce.number().int().positive().default(60_000),
})

const runStreamQuerySchema = z.object({
  afterEventId: z.coerce.number().int().nonnegative().default(0),
})

const runContextQuerySchema = z.object({
  keys: z.string().min(1).optional(),
})

const runIdParamsSchema = z.object({
  runId: z.uuid(),
})

const workflowNameParamsSchema = z.object({
  workflowName: z.string().min(1),
})

const correlationKeyParamsSchema = z.object({
  correlationKey: z.string().min(1),
})

const externalSessionParamsSchema = z.object({
  externalId: z.string().min(1),
})

const signalParamsSchema = z.object({
  runId: z.uuid(),
  signalName: z.string().min(1),
})

const cancelRunBodySchema = z.object({
  mode: z.enum(["graceful", "hard"]).default("graceful"),
  reason: z.string().min(1).max(1_000).optional(),
})

const createScheduleBodySchema = z.object({
  workflowName: z.string().min(1),
  cronExpression: z.string().min(1),
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
})

const reconcileBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(1_000).default(100),
})

const rewindRunBodySchema = z.object({
  toAttemptId: z.uuid(),
})

const forkRunBodySchema = z.object({
  fromAttemptId: z.uuid(),
})

const terminalRunStatuses = new Set([
  "completed",
  "failed",
  "compensation_failed",
  "exhausted_budget",
  "canceled",
])

const projectContextValue = (
  source: JsonObject,
  dottedKey: string
): JsonValue | undefined => {
  const parts = dottedKey.split(".").filter((part) => part.length > 0)
  let current: JsonValue | undefined = source

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined
    }

    current = current[part]
  }

  return current
}

const projectRunContext = (source: JsonObject, keys: string[]) => {
  if (keys.length === 0) {
    return source
  }

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = projectContextValue(source, key)
      return value === undefined ? [] : [[key, value]]
    })
  )
}

const requireApiAuth = async (
  app: FastifyInstance,
  request: FastifyRequest,
  auth: HippoAuth,
  tracer?: HippoTracer
) => {
  const verify = () => {
    if (!auth.verifyApiRequest(request)) {
      throw app.httpErrors.unauthorized()
    }
  }

  if (!tracer) {
    verify()
    return
  }

  await tracer.withSpan(
    {
      name: "hippo.http.api_auth",
      attributes: createRouteTraceAttributes({
        method: request.method,
        operation: "http.api_auth",
        route: request.routeOptions.url ?? request.url,
      }),
    },
    async () => {
      verify()
    }
  )
}

const getIdempotencyKey = (request: FastifyRequest) => {
  const header =
    request.headers["idempotency-key"] ??
    request.headers["x-idempotency-key"]

  return typeof header === "string" && header.length > 0 ? header : undefined
}

const requireCallbackAuth = (
  app: FastifyInstance,
  request: FastifyRequest,
  body: JsonValue,
  auth: HippoAuth
) => {
  if (!auth.verifyCallbackRequest(request, body)) {
    throw app.httpErrors.unauthorized()
  }
}

const getExistingRun = async (
  app: FastifyInstance,
  store: WorkflowStore,
  runId: string
) => {
  const run = await store.getRun(runId)

  if (!run) {
    throw app.httpErrors.notFound(`Run "${runId}" not found`)
  }

  return run
}

const propagateCancellation = async (args: {
  mode: "graceful" | "hard"
  reason: string | undefined
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await args.store.requestCancelRun({
      runId: childRun.id,
      mode: args.mode,
      ...(args.reason === undefined ? {} : { reason: args.reason }),
    })

    await propagateCancellation({
      mode: args.mode,
      reason: args.reason,
      runId: childRun.id,
      store: args.store,
    })
  }
}

const compensateRunTree = async (args: {
  engine: WorkflowEngine
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await compensateRunTree({
      engine: args.engine,
      runId: childRun.id,
      store: args.store,
    })
  }

  return args.engine.runCompensation(args.runId)
}

const traceRequest = <T>(
  tracer: HippoTracer,
  input: {
    name: string
    attributes?: Record<string, string | number | boolean>
  },
  run: () => Promise<T>
) => tracer.withSpan(input, run)

const traceAuthedRequest = <T>(args: {
  app: FastifyInstance
  auth: HippoAuth
  request: FastifyRequest
  tracer: HippoTracer
  trace: {
    name: string
    attributes?: Record<string, string | number | boolean>
  }
  run: () => Promise<T>
}) =>
  traceRequest(args.tracer, args.trace, async () => {
    await requireApiAuth(args.app, args.request, args.auth, args.tracer)
    return args.run()
  })

const createRouteTraceAttributes = (args: {
  method: string
  operation: string
  route: string
}) => ({
  ...createTraceAttributes({
    operation: args.operation,
  }),
  "http.method": args.method,
  "http.route": args.route,
})

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
  app.get("/dashboard.css", async (request, reply) => {
    try {
      const filePath = fileURLToPath(new URL("../views/dashboard/styles.css", import.meta.url))
      const css = await readFile(filePath, "utf-8")
      reply.type("text/css").send(css)
    } catch {
      reply.type("text/css").send("/* styles.css not compiled yet */")
    }
  })

  app.get("/dashboard", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    reply.redirect("/dashboard/runs", 302)
  })

  const runsListQuerySchema = z.object({
    status: z.string().optional(),
    definition: optionalQueryText,
    search: optionalQueryText,
    afterUpdatedAt: z.string().optional(),
    afterId: z.string().optional(),
  })

  app.get("/dashboard/runs", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_runs_index",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_runs_index",
          route: "/dashboard/runs",
        }),
      },
      run: async () => {
        const query = runsListQuerySchema.parse(request.query)
        const statusFilter = resolveStatusFilter(query.status)

        const afterUpdatedAt =
          query.afterUpdatedAt && query.afterId
            ? new Date(query.afterUpdatedAt)
            : undefined

        const limit = RUNS_PAGE_SIZE
        const runs = await args.store.listRunsPaginated({
          limit: limit + 1,
          ...(statusFilter.statuses.length > 0
            ? { statuses: statusFilter.statuses }
            : {}),
          ...(query.definition === undefined
            ? {}
            : { workflowName: query.definition }),
          ...(query.search === undefined ? {} : { search: query.search }),
          ...(afterUpdatedAt && query.afterId
            ? { afterUpdatedAt, afterId: query.afterId }
            : {}),
        })

        const hasMore = runs.length > limit
        const pageRuns = hasMore ? runs.slice(0, limit) : runs
        const lastRun = pageRuns.at(-1)

        const document = renderRunsIndexDocument({
          runs: pageRuns,
          workflows: args.engine.listWorkflows().map((workflow) => ({
            name: workflow.name,
            ...(workflow.title === undefined ? {} : { title: workflow.title }),
          })),
          filters: {
            status: statusFilter.id,
            definition: query.definition,
            search: query.search,
          },
          nextCursor:
            hasMore && lastRun
              ? { afterUpdatedAt: lastRun.updatedAt, afterId: lastRun.id }
              : null,
        })

        reply.header("content-type", "text/html; charset=utf-8")
        return document
      },
    })
  })

  app.get("/dashboard/definitions", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_definitions_index",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_definitions_index",
          route: "/dashboard/definitions",
        }),
      },
      run: async () => {
        const workflows = args.engine.listWorkflows().map((workflow) => ({
          name: workflow.name,
          ...(workflow.title === undefined ? {} : { title: workflow.title }),
          stepCount: Object.keys(workflow.steps).length,
        }))

        const document = renderDefinitionsIndexDocument({ workflows })
        reply.header("content-type", "text/html; charset=utf-8")
        return document
      },
    })
  })

  app.get("/dashboard/definitions/:workflowName", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_definition_detail",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_definition_detail",
          route: "/dashboard/definitions/:workflowName",
        }),
      },
      run: async () => {
        const params = z
          .object({ workflowName: z.string().min(1) })
          .parse(request.params)
        const workflow = args.engine
          .listWorkflows()
          .find((candidate) => candidate.name === params.workflowName)

        if (!workflow) {
          throw app.httpErrors.notFound(
            `Workflow "${params.workflowName}" not found`
          )
        }

        const runs = await args.store.listRunsPaginated({
          limit: 20,
          workflowName: workflow.name,
        })

        const document = renderDefinitionDetailDocument({
          workflow: {
            name: workflow.name,
            ...(workflow.title === undefined ? {} : { title: workflow.title }),
          },
          mermaid: renderWorkflowAsMermaid(workflow),
          nodeActions: createWorkflowStepActions(workflow, {
            hrefByStepKey: () =>
              `/dashboard/runs?definition=${encodeURIComponent(workflow.name)}`,
          }),
          runs,
        })

        reply.header("content-type", "text/html; charset=utf-8")
        return document
      },
    })
  })

  app.get("/dashboard/runs/:runId", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_run_detail",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_run_detail",
          route: "/dashboard/runs/:runId",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const run = await getExistingRun(app, args.store, params.runId)
        const [events, attempts, lineage, usage] = await Promise.all([
          args.store.getRunEvents(run.id),
          args.store.getRunAttempts(run.id),
          args.store.listRunLineage(run.id),
          args.store.getRunUsage(run.id),
        ])
        const workflow = args.engine.getWorkflow(
          run.definitionName,
          run.definitionVersion
        )
        const document = renderRunDetailDocument({
          attempts:
            attempts.length > 0
              ? attempts.map((attempt, index) => renderAttemptCard(attempt, run.id, !!run.supersededByRunId, index)).join("")
              : '<div class="entry">No attempts recorded yet.</div>',
          events:
            events.length > 0
              ? events.map(renderEventCard).join("")
              : '<div class="entry">No workflow events recorded yet.</div>',
          lastEventId: events.at(-1)?.id ?? 0,
          lineage:
            lineage.length > 0
              ? lineage.map(renderLineageRunCard).join("")
              : '<div class="entry">No lineage recorded yet.</div>',
          run,
          usage:
            usage.length > 0
              ? usage.map(renderUsageCard).join("")
              : '<div class="entry">No usage recorded yet.</div>',
          workflowMermaid: renderWorkflowAsMermaid(workflow, {
            ...(run.currentStepKey === null
              ? {}
              : { highlightedStepKey: run.currentStepKey }),
          }),
          workflowStepActions: createWorkflowStepActions(workflow),
        })

        reply.header("content-type", "text/html; charset=utf-8")
        return document
      },
    })
  })

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

  app.get("/v1/operators/runs", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.list_runs",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.list_runs",
          route: "/v1/operators/runs",
        }),
      },
      run: async () => {
        const query = operatorRunsQuerySchema.parse(request.query)
        const limit = query.limit
        const runs = await args.store.listRunsPaginated({
          limit: limit + 1,
          ...(query.status === undefined ? {} : { statuses: [query.status] }),
          ...(query.workflowName === undefined ? {} : { workflowName: query.workflowName }),
          ...(query.search === undefined ? {} : { search: query.search }),
          ...(query.parentRunId === undefined ? {} : { parentRunId: query.parentRunId }),
          ...(query.taskQueue === undefined ? {} : { taskQueue: query.taskQueue }),
          ...(query.afterUpdatedAt && query.afterId
            ? {
                afterUpdatedAt: new Date(query.afterUpdatedAt),
                afterId: query.afterId,
              }
            : {}),
        })

        const hasMore = runs.length > limit
        const pageRuns = hasMore ? runs.slice(0, limit) : runs
        const lastRun = pageRuns.at(-1)

        return {
          runs: pageRuns,
          nextCursor:
            hasMore && lastRun
              ? {
                  afterUpdatedAt: lastRun.updatedAt.toISOString(),
                  afterId: lastRun.id,
                }
              : null,
        }
      },
    })
  })

  app.get("/v1/operators/runs/active", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.list_active_runs",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.list_active_runs",
          route: "/v1/operators/runs/active",
        }),
      },
      run: async () => {
        const query = operatorListQuerySchema.parse(request.query)
        return {
          runs: await args.store.listActiveRuns(query.limit),
        }
      },
    })
  })

  app.get("/v1/operators/runs/failed", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.list_failed_runs",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.list_failed_runs",
          route: "/v1/operators/runs/failed",
        }),
      },
      run: async () => {
        const query = operatorListQuerySchema.parse(request.query)
        return {
          runs: await args.store.listFailedRuns(query.limit),
        }
      },
    })
  })

  app.get("/v1/operators/runs/stuck", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.list_stuck_runs",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.list_stuck_runs",
          route: "/v1/operators/runs/stuck",
        }),
      },
      run: async () => {
        const query = stuckRunsQuerySchema.parse(request.query)
        return {
          runs: await args.store.listStuckRuns(query),
        }
      },
    })
  })

  app.get("/v1/operators/runs/:runId/lineage", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.run_lineage",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.run_lineage",
          route: "/v1/operators/runs/:runId/lineage",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        await getExistingRun(app, args.store, params.runId)

        return {
          runs: await args.store.listRunLineage(params.runId),
        }
      },
    })
  })

  app.post("/v1/operators/runs/:runId/cancel", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.cancel_run",
        attributes: {
          ...createRouteTraceAttributes({
            method: request.method,
            operation: "http.cancel_run",
            route: "/v1/operators/runs/:runId/cancel",
          }),
        },
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const body = cancelRunBodySchema.parse(request.body ?? {})
        const existingRun = await getExistingRun(app, args.store, params.runId)

        if (
          existingRun.status === "completed" ||
          existingRun.status === "canceled"
        ) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" cannot be canceled from status "${existingRun.status}"`
          )
        }

        if (body.mode === "hard") {
          await args.engine.cancelExternalSessionsForRun(existingRun.id)
        }

        const run = await args.store.requestCancelRun({
          runId: params.runId,
          mode: body.mode,
          ...(body.reason === undefined ? {} : { reason: body.reason }),
        })

        if (!run) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" could not be canceled`
          )
        }

        await propagateCancellation({
          mode: body.mode,
          reason: body.reason,
          runId: run.id,
          store: args.store,
        })

        const compensatedRun =
          body.mode === "hard"
            ? await compensateRunTree({
                engine: args.engine,
                runId: run.id,
                store: args.store,
              })
            : null

        return {
          runId: run.id,
          status: compensatedRun?.status ?? run.status,
          currentStepKey: compensatedRun?.currentStepKey ?? run.currentStepKey,
        }
      },
    })
  })

  app.post("/v1/operators/runs/:runId/terminate", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.terminate_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.terminate_run",
          route: "/v1/operators/runs/:runId/terminate",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const body = z
          .object({
            reason: z.string().min(1).max(1_000).optional(),
          })
          .parse(request.body ?? {})

        await args.engine.cancelExternalSessionsForRun(params.runId)

        const run = await args.store.requestCancelRun({
          runId: params.runId,
          mode: "hard",
          ...(body.reason === undefined ? {} : { reason: body.reason }),
        })

        if (!run) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" could not be terminated`
          )
        }

        await propagateCancellation({
          mode: "hard",
          reason: body.reason,
          runId: run.id,
          store: args.store,
        })

        const compensatedRun = await compensateRunTree({
          engine: args.engine,
          runId: run.id,
          store: args.store,
        })

        return {
          runId: run.id,
          status: compensatedRun?.status ?? run.status,
          currentStepKey: compensatedRun?.currentStepKey ?? run.currentStepKey,
        }
      },
    })
  })

  app.post("/v1/operators/runs/:runId/retry", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.retry_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.retry_run",
          route: "/v1/operators/runs/:runId/retry",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const existingRun = await getExistingRun(app, args.store, params.runId)

        if (existingRun.status !== "failed") {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" cannot be retried from status "${existingRun.status}"`
          )
        }

        const run = await args.store.retryRun(params.runId)

        if (!run) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" could not be retried`
          )
        }

        reply.code(202)
        return {
          runId: run.id,
          status: run.status,
          currentStepKey: run.currentStepKey,
        }
      },
    })
  })

  app.post("/v1/operators/runs/:runId/rewind", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.rewind_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.rewind_run",
          route: "/v1/operators/runs/:runId/rewind",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const body = rewindRunBodySchema.parse(request.body ?? {})
        const existingRun = await getExistingRun(app, args.store, params.runId)



        if (existingRun.supersededByRunId) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" has already been rewound`
          )
        }

        const run = await args.store.branchRun({
          runId: params.runId,
          attemptId: body.toAttemptId,
          mode: "rewind",
        })

        if (!run) {
          throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
        }

        reply.code(202)
        return {
          runId: run.id,
          sourceRunId: params.runId,
          status: run.status,
          currentStepKey: run.currentStepKey,
        }
      },
    })
  })

  app.post("/v1/operators/runs/:runId/fork", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.fork_run",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.fork_run",
          route: "/v1/operators/runs/:runId/fork",
        }),
      },
      run: async () => {
        const params = runIdParamsSchema.parse(request.params)
        const body = forkRunBodySchema.parse(request.body ?? {})
        const existingRun = await getExistingRun(app, args.store, params.runId)

        if (!terminalRunStatuses.has(existingRun.status)) {
          throw app.httpErrors.conflict(
            `Run "${params.runId}" must be terminal before fork`
          )
        }

        const run = await args.store.branchRun({
          runId: params.runId,
          attemptId: body.fromAttemptId,
          mode: "fork",
        })

        if (!run) {
          throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
        }

        reply.code(202)
        return {
          runId: run.id,
          sourceRunId: params.runId,
          status: run.status,
          currentStepKey: run.currentStepKey,
        }
      },
    })
  })

  app.post("/v1/operators/recovery/reconcile", async (request) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.reconcile_recovery",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.reconcile_recovery",
          route: "/v1/operators/recovery/reconcile",
        }),
      },
      run: async () => {
        const body = reconcileBodySchema.parse(request.body ?? {})
        const reclaimed = await runRecoveryPass({
          limit: body.limit,
          metrics: args.metrics,
          store: args.store,
          tracer: args.tracer,
        })

        return {
          reclaimed,
        }
      },
    })
  })

  app.post("/v1/operators/schedules", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.create_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.create_schedule",
          route: "/v1/operators/schedules",
        }),
      },
      run: async () => {
        const body = createScheduleBodySchema.parse(request.body ?? {})

        if (!args.engine.hasWorkflow(body.workflowName)) {
          throw app.httpErrors.notFound(
            `Workflow "${body.workflowName}" is not registered`
          )
        }

        const schedule = await args.store.createSchedule({
          workflowName: body.workflowName,
          cronExpression: body.cronExpression,
          payload: body.payload,
          taskQueue: body.taskQueue,
          priority: body.priority,
          nextFireAt: computeNextScheduleFireAt({
            cronExpression: body.cronExpression,
          }),
        })

        reply.code(201)
        return {
          schedule,
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

        return {
          run,
          attempts,
          events,
          lineage,
          usage,
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
            await traceRequest(
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

  app.post("/v1/waits/:correlationKey/resume", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.resume_wait",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.resume_wait",
          route: "/v1/waits/:correlationKey/resume",
        }),
      },
      async () => {
        const rawBody = (request.body ?? {}) as JsonValue
        requireCallbackAuth(app, request, rawBody, args.auth)

        const params = correlationKeyParamsSchema.parse(request.params)
        const body = resumeBodySchema.parse(request.body ?? {})
        const run = await args.engine.resumeWait(
          body.payload === undefined
            ? { correlationKey: params.correlationKey }
            : { correlationKey: params.correlationKey, payload: body.payload }
        )

        if (run.status === "missing") {
          throw app.httpErrors.notFound(
            `Open wait "${params.correlationKey}" not found`
          )
        }

        reply.code(run.status === "duplicate" ? 200 : 202)
        return {
          outcome: run.status,
          runId: run.run?.id ?? null,
          status: run.run?.status ?? null,
          currentStepKey: run.run?.currentStepKey ?? null,
        }
      }
    )
  })

  app.post("/v1/external-sessions/:externalId/resume", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.resume_external_session",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.resume_external_session",
          route: "/v1/external-sessions/:externalId/resume",
        }),
      },
      async () => {
        const rawBody = (request.body ?? {}) as JsonValue
        requireCallbackAuth(app, request, rawBody, args.auth)

        const params = externalSessionParamsSchema.parse(request.params)
        const body = resumeBodySchema.parse(request.body ?? {})
        const run = await args.engine.resumeExternalSession(
          body.payload === undefined
            ? { externalSessionId: params.externalId }
            : { externalSessionId: params.externalId, payload: body.payload }
        )

        if (run.status === "missing") {
          throw app.httpErrors.notFound(
            `Open external session "${params.externalId}" not found`
          )
        }

        reply.code(run.status === "duplicate" ? 200 : 202)
        return {
          outcome: run.status,
          runId: run.run?.id ?? null,
          status: run.run?.status ?? null,
          currentStepKey: run.run?.currentStepKey ?? null,
        }
      }
    )
  })

  app.post("/v1/external-sessions/:externalId/heartbeat", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.external_session_heartbeat",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.external_session_heartbeat",
          route: "/v1/external-sessions/:externalId/heartbeat",
        }),
      },
      async () => {
        const rawBody = (request.body ?? {}) as JsonValue
        requireCallbackAuth(app, request, rawBody, args.auth)

        const params = externalSessionParamsSchema.parse(request.params)
        const body = externalHeartbeatBodySchema.parse(request.body ?? {})
        const usage =
          body.usage === undefined
            ? undefined
            : {
                resource: body.usage.resource,
                amount: body.usage.amount,
                ...(body.usage.costUsd === undefined
                  ? {}
                  : { costUsd: body.usage.costUsd }),
              }
        const payload: JsonObject = {
          ...(body.progress === undefined ? {} : { progress: body.progress }),
          ...(body.message === undefined ? {} : { message: body.message }),
          ...(usage === undefined ? {} : { usage }),
        }
        const heartbeat = await args.store.recordExternalHeartbeat({
          externalSessionId: params.externalId,
          leaseMs: args.externalHeartbeatLeaseMs,
          payload,
        })

        if (heartbeat.status === "missing") {
          throw app.httpErrors.notFound(
            `Open external session "${params.externalId}" not found`
          )
        }

        if (heartbeat.status === "stale") {
          throw app.httpErrors.conflict(
            `External session "${params.externalId}" is not heartbeatable`
          )
        }

        let budgetOutcome:
          | {
              runId: string
              status: "exhausted_budget"
            }
          | null = null

        if (usage !== undefined && heartbeat.runId) {
          const run = await args.store.getRun(heartbeat.runId)
          const workflow =
            run === null
              ? null
              : args.engine.getWorkflow(run.definitionName, run.definitionVersion)

          try {
            await args.store.recordUsage({
              runId: heartbeat.runId,
              stepKey: heartbeat.stepKey,
              stepAttemptId: heartbeat.attemptId,
              usage,
              ...(workflow?.budget === undefined ? {} : { budget: workflow.budget }),
            })
          } catch (error) {
            if (!(error instanceof BudgetExceededError)) {
              throw error
            }

            budgetOutcome = {
              runId: error.run.id,
              status: "exhausted_budget",
            }
          }
        }

        reply.code(202)
        return {
          outcome: budgetOutcome?.status ?? heartbeat.status,
          runId: heartbeat.runId,
          stepKey: heartbeat.stepKey,
          attemptId: heartbeat.attemptId,
        }
      }
    )
  })

  app.post("/v1/external-sessions/:externalId/events", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.external_session_events",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.external_session_events",
          route: "/v1/external-sessions/:externalId/events",
        }),
      },
      async () => {
        const rawBody = (request.body ?? {}) as JsonValue
        requireCallbackAuth(app, request, rawBody, args.auth)

        const params = externalSessionParamsSchema.parse(request.params)
        const body = externalSessionEventsBodySchema.parse(request.body ?? {})
        const recordedEvents = []

        for (const event of body.events) {
          const recorded = await args.store.recordExternalSessionEvent({
            externalSessionId: params.externalId,
            type: event.type,
            data: event.data,
          })

          if (recorded.status === "missing") {
            throw app.httpErrors.notFound(
              `Open external session "${params.externalId}" not found`
            )
          }

          if (recorded.status === "stale") {
            throw app.httpErrors.conflict(
              `External session "${params.externalId}" is not accepting events`
            )
          }

          recordedEvents.push(recorded)
        }

        reply.code(202)
        return {
          outcome: "recorded",
          count: recordedEvents.length,
          events: recordedEvents.map((event) => ({
            runId: event.runId,
            stepKey: event.stepKey,
            attemptId: event.attemptId,
            eventId: event.eventId,
          })),
        }
      }
    )
  })

  app.get("/v1/workflows/:workflowName/render", async (request, reply) => {
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.render_workflow",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.render_workflow",
          route: "/v1/workflows/:workflowName/render",
        }),
      },
      run: async () => {
        const params = workflowNameParamsSchema.parse(request.params)

        if (!args.engine.hasWorkflow(params.workflowName)) {
          throw app.httpErrors.notFound(
            `Workflow "${params.workflowName}" is not registered`
          )
        }

        const workflow = args.engine.getWorkflow(params.workflowName)
        const document = renderWorkflowAsMermaid(workflow)

        reply.header("content-type", "text/plain; charset=utf-8")
        return document
      },
    })
  })
}
