import type { FastifyInstance } from "fastify"
import { computeNextScheduleFireAt } from "../../lib/scheduler.js"
import {
  createScheduleBodySchema,
  scheduleIdParamsSchema,
} from "./schemas.js"
import {
  createRouteTraceAttributes,
  requireApiAuth,
  traceAuthedRequest,
  type WorkflowRouteContext,
} from "./helpers.js"

export const registerSchedulesOperatorRoutes = (
  app: FastifyInstance,
  args: WorkflowRouteContext
) => {
  app.post("/v1/operators/schedules", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
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

  app.get("/v1/operators/schedules", async (request) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.list_schedules",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.list_schedules",
          route: "/v1/operators/schedules",
        }),
      },
      run: async () => {
        const list = await args.store.listSchedules()
        return {
          schedules: list,
        }
      },
    })
  })

  app.delete("/v1/operators/schedules/:scheduleId", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.delete_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.delete_schedule",
          route: "/v1/operators/schedules/:scheduleId",
        }),
      },
      run: async () => {
        const params = scheduleIdParamsSchema.parse(request.params)
        await args.store.deleteSchedule(params.scheduleId)
        reply.code(204)
        return null
      },
    })
  })

  app.post("/v1/operators/schedules/:scheduleId/pause", async (request) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.pause_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.pause_schedule",
          route: "/v1/operators/schedules/:scheduleId/pause",
        }),
      },
      run: async () => {
        const params = scheduleIdParamsSchema.parse(request.params)
        const list = await args.store.listSchedules()
        const schedule = list.find((s) => s.id === params.scheduleId)
        if (!schedule) {
          throw app.httpErrors.notFound(`Schedule "${params.scheduleId}" not found`)
        }
        const updated = await args.store.updateScheduleActive({
          id: params.scheduleId,
          active: false,
          nextFireAt: schedule.nextFireAt,
        })
        return { schedule: updated }
      },
    })
  })

  app.post("/v1/operators/schedules/:scheduleId/resume", async (request) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.resume_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.resume_schedule",
          route: "/v1/operators/schedules/:scheduleId/resume",
        }),
      },
      run: async () => {
        const params = scheduleIdParamsSchema.parse(request.params)
        const list = await args.store.listSchedules()
        const schedule = list.find((s) => s.id === params.scheduleId)
        if (!schedule) {
          throw app.httpErrors.notFound(`Schedule "${params.scheduleId}" not found`)
        }
        const nextFireAt = computeNextScheduleFireAt({
          cronExpression: schedule.cronExpression,
        })
        const updated = await args.store.updateScheduleActive({
          id: params.scheduleId,
          active: true,
          nextFireAt,
        })
        return { schedule: updated }
      },
    })
  })
}
