import type { FastifyInstance } from "fastify"

import { renderWorkflowAsMermaid } from "../../lib/workflow-definition.js"
import { BudgetExceededError } from "../../lib/workflow-store.js"
import type { JsonObject, JsonValue } from "../../types/json.js"
import {
  correlationKeyParamsSchema,
  externalHeartbeatBodySchema,
  externalSessionEventsBodySchema,
  externalSessionParamsSchema,
  resumeBodySchema,
  workflowNameParamsSchema,
} from "./schemas.js"
import {
  createRouteTraceAttributes,
  requireCallbackAuth,
  traceAuthedRequest,
  traceRawRequest,
  type WorkflowRouteContext,
} from "./helpers.js"

export const registerCallbackRoutes = (
  app: FastifyInstance,
  args: WorkflowRouteContext
) => {
  app.post("/v1/waits/:correlationKey/resume", async (request, reply) => {
    return traceRawRequest(
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
    return traceRawRequest(
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
    return traceRawRequest(
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
    return traceRawRequest(
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
