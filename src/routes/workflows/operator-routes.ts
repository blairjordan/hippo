import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { runRecoveryPass } from "../../lib/recovery.js"
import {
  cancelRunBodySchema,
  forkRunBodySchema,
  operatorListQuerySchema,
  operatorRunsQuerySchema,
  reconcileBodySchema,
  rewindRunBodySchema,
  runIdParamsSchema,
  stuckRunsQuerySchema,
  terminalRunStatuses,
} from "./schemas.js"
import {
  compensateRunTree,
  createRouteTraceAttributes,
  getExistingRun,
  paginateRuns,
  propagateCancellation,
  traceAuthedRequest,
  cancelExternalSessionsTree,
  type WorkflowRouteContext,
} from "./helpers.js"

export const registerOperatorRoutes = (
  app: FastifyInstance,
  args: WorkflowRouteContext
) => {
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
        return paginateRuns(query, (paged) =>
          args.store.listRunsPaginated({
            limit: paged.limit,
            ...(query.status === undefined ? {} : { statuses: [query.status] }),
            ...(query.workflowName === undefined
              ? {}
              : { workflowName: query.workflowName }),
            ...(query.search === undefined ? {} : { search: query.search }),
            ...(query.parentRunId === undefined
              ? {}
              : { parentRunId: query.parentRunId }),
            ...(query.taskQueue === undefined
              ? {}
              : { taskQueue: query.taskQueue }),
            ...(query.metadata === undefined
              ? {}
              : { metadata: query.metadata }),
            ...(paged.afterUpdatedAt
              ? { afterUpdatedAt: paged.afterUpdatedAt }
              : {}),
            ...(paged.afterId ? { afterId: paged.afterId } : {}),
          })
        )
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
        return paginateRuns(query, (paged) => args.store.listActiveRuns(paged))
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
        return paginateRuns(query, (paged) => args.store.listFailedRuns(paged))
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
        return paginateRuns(query, (paged) =>
          args.store.listStuckRuns({ ...paged, olderThanMs: query.olderThanMs })
        )
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
          await cancelExternalSessionsTree({
            engine: args.engine,
            runId: existingRun.id,
            store: args.store,
          })
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

        await cancelExternalSessionsTree({
          engine: args.engine,
          runId: params.runId,
          store: args.store,
        })

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

        if (!terminalRunStatuses.has(existingRun.status)) {
          await cancelExternalSessionsTree({
            engine: args.engine,
            runId: existingRun.id,
            store: args.store,
          })
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
}
