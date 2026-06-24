import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../lib/workflow-definition.js"
import type { HippoAuth } from "../lib/auth.js"
import type { HippoMetrics } from "../lib/metrics.js"
import { runRecoveryPass } from "../lib/recovery.js"
import type { WorkflowEngine } from "../lib/workflow-engine.js"
import type { WorkflowStore } from "../lib/workflow-store.js"
import type { JsonObject, JsonValue } from "../types/json.js"

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

const startRunBodySchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema
)

const resumeBodySchema = z.object({
  payload: jsonValueSchema.optional(),
})

const operatorListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
})

const stuckRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  olderThanMs: z.coerce.number().int().positive().default(60_000),
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

const signalParamsSchema = z.object({
  runId: z.uuid(),
  signalName: z.string().min(1),
})

const cancelRunBodySchema = z.object({
  reason: z.string().min(1).max(1_000).optional(),
})

const reconcileBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(1_000).default(100),
})

const requireApiAuth = (
  app: FastifyInstance,
  request: FastifyRequest,
  auth: HippoAuth
) => {
  if (!auth.verifyApiRequest(request)) {
    throw app.httpErrors.unauthorized()
  }
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

export const createWorkflowRoutes = (args: {
  auth: HippoAuth
  engine: WorkflowEngine
  metrics: HippoMetrics
  store: WorkflowStore
}): FastifyPluginAsync => async (app) => {
  app.post("/v1/workflows/:workflowName/runs", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = workflowNameParamsSchema.parse(request.params)
    const payload = startRunBodySchema.parse(request.body ?? {})

    if (!args.engine.hasWorkflow(params.workflowName)) {
      throw app.httpErrors.notFound(
        `Workflow "${params.workflowName}" is not registered`
      )
    }

    const run = await args.engine.startRun({
      workflowName: params.workflowName,
      payload,
    })

    reply.code(202)
    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.get("/v1/operators/runs/active", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = operatorListQuerySchema.parse(request.query)
    return {
      runs: await args.store.listActiveRuns(query.limit),
    }
  })

  app.get("/v1/operators/runs/failed", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = operatorListQuerySchema.parse(request.query)
    return {
      runs: await args.store.listFailedRuns(query.limit),
    }
  })

  app.get("/v1/operators/runs/stuck", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = stuckRunsQuerySchema.parse(request.query)
    return {
      runs: await args.store.listStuckRuns(query),
    }
  })

  app.post("/v1/operators/runs/:runId/cancel", async (request) => {
    requireApiAuth(app, request, args.auth)

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

    const run = await args.store.cancelRun(
      body.reason === undefined
        ? { runId: params.runId }
        : { runId: params.runId, reason: body.reason }
    )

    if (!run) {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" could not be canceled`
      )
    }

    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.post("/v1/operators/runs/:runId/retry", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

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
  })

  app.post("/v1/operators/recovery/reconcile", async (request) => {
    requireApiAuth(app, request, args.auth)

    const body = reconcileBodySchema.parse(request.body ?? {})
    const reclaimed = await runRecoveryPass({
      limit: body.limit,
      metrics: args.metrics,
      store: args.store,
    })

    return {
      reclaimed,
    }
  })

  app.post("/v1/runs/:runId/signals/:signalName", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

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
  })

  app.get("/v1/runs/:runId", async (request) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const run = await args.store.getRun(params.runId)

    if (!run) {
      throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
    }

    const [events, attempts] = await Promise.all([
      args.store.getRunEvents(run.id),
      args.store.getRunAttempts(run.id),
    ])

    return {
      run,
      attempts,
      events,
    }
  })

  app.post("/v1/waits/:correlationKey/resume", async (request, reply) => {
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
  })

  app.get("/v1/workflows/:workflowName/render", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

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
  })
}
