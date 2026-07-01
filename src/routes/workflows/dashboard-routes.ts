import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../../lib/workflow-definition.js"
import { computeNextScheduleFireAt } from "../../lib/scheduler.js"
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
  renderSchedulesIndexDocument,
} from "../dashboard.js"
import { optionalQueryText, runIdParamsSchema } from "./schemas.js"
import {
  createRouteTraceAttributes,
  getExistingRun,
  requireApiAuth,
  traceAuthedRequest,
  type WorkflowRouteContext,
} from "./helpers.js"

export const registerDashboardRoutes = (
  app: FastifyInstance,
  args: WorkflowRouteContext
) => {
  app.get("/dashboard.css", async (request, reply) => {
    try {
      const filePath = fileURLToPath(
        new URL("../../views/dashboard/styles.css", import.meta.url)
      )
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
         const [events, attempts, lineageParentFork, childRuns, usage] = await Promise.all([
          args.store.getRunEvents(run.id),
          args.store.getRunAttempts(run.id),
          args.store.listRunLineage(run.id),
          args.store.listChildRuns(run.id),
          args.store.getRunUsage(run.id),
        ])
        const lineageMap = new Map<string, typeof lineageParentFork[number]>()
        for (const r of lineageParentFork) {
          lineageMap.set(r.id, r)
        }
        for (const r of childRuns) {
          lineageMap.set(r.id, r)
        }
        const lineage = Array.from(lineageMap.values())
        const workflow = args.engine.getWorkflow(
          run.definitionName,
          run.definitionVersion
        )
        const document = renderRunDetailDocument({
          attempts:
            attempts.length > 0
              ? attempts
                  .map((attempt, index) =>
                    renderAttemptCard(
                      attempt,
                      run.id,
                      !!run.supersededByRunId,
                      index
                    )
                  )
                  .join("")
              : '<div class="entry">No attempts recorded yet.</div>',
          attemptsList: attempts,
          lineageList: lineage,
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

  app.get("/dashboard/schedules", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_schedules",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_schedules",
          route: "/dashboard/schedules",
        }),
      },
      run: async () => {
        const schedules = await args.store.listSchedules()
        const workflows = args.engine.listWorkflows().map((w) => ({
          name: w.name,
          ...(w.title === undefined ? {} : { title: w.title }),
        }))
        const html = renderSchedulesIndexDocument({
          schedules,
          workflows,
        })
        reply.header("content-type", "text/html; charset=utf-8")
        return html
      },
    })
  })

  app.post("/dashboard/schedules", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_create_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_create_schedule",
          route: "/dashboard/schedules",
        }),
      },
      run: async () => {
        const body = request.body as Record<string, string | undefined>
        const workflowName = body.workflowName ?? ""
        const cronExpression = body.cronExpression ?? ""
        const taskQueue = body.taskQueue || "default"
        const priority = parseInt(body.priority || "0", 10)
        let payload = {}
        if (body.payload) {
          try {
            payload = JSON.parse(body.payload)
          } catch {
            // ignore/fallback
          }
        }

        if (!args.engine.hasWorkflow(workflowName)) {
          throw app.httpErrors.notFound(`Workflow "${workflowName}" is not registered`)
        }

        await args.store.createSchedule({
          workflowName,
          cronExpression,
          taskQueue,
          priority,
          payload,
          nextFireAt: computeNextScheduleFireAt({ cronExpression }),
        })

        reply.redirect("/dashboard/schedules")
      },
    })
  })

  app.post("/dashboard/schedules/:scheduleId/pause", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_pause_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_pause_schedule",
          route: "/dashboard/schedules/:scheduleId/pause",
        }),
      },
      run: async () => {
        const params = request.params as { scheduleId: string }
        const list = await args.store.listSchedules()
        const schedule = list.find((s) => s.id === params.scheduleId)
        if (!schedule) {
          throw app.httpErrors.notFound(`Schedule "${params.scheduleId}" not found`)
        }

        await args.store.updateScheduleActive({
          id: params.scheduleId,
          active: false,
          nextFireAt: schedule.nextFireAt,
        })

        reply.redirect("/dashboard/schedules")
      },
    })
  })

  app.post("/dashboard/schedules/:scheduleId/resume", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_resume_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_resume_schedule",
          route: "/dashboard/schedules/:scheduleId/resume",
        }),
      },
      run: async () => {
        const params = request.params as { scheduleId: string }
        const list = await args.store.listSchedules()
        const schedule = list.find((s) => s.id === params.scheduleId)
        if (!schedule) {
          throw app.httpErrors.notFound(`Schedule "${params.scheduleId}" not found`)
        }

        const nextFireAt = computeNextScheduleFireAt({
          cronExpression: schedule.cronExpression,
        })

        await args.store.updateScheduleActive({
          id: params.scheduleId,
          active: true,
          nextFireAt,
        })

        reply.redirect("/dashboard/schedules")
      },
    })
  })

  app.post("/dashboard/schedules/:scheduleId/delete", async (request, reply) => {
    await requireApiAuth(app, request, args.auth, args.tracer)
    return traceAuthedRequest({
      app,
      auth: args.auth,
      request,
      tracer: args.tracer,
      trace: {
        name: "hippo.http.dashboard_delete_schedule",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.dashboard_delete_schedule",
          route: "/dashboard/schedules/:scheduleId/delete",
        }),
      },
      run: async () => {
        const params = request.params as { scheduleId: string }
        await args.store.deleteSchedule(params.scheduleId)
        reply.redirect("/dashboard/schedules")
      },
    })
  })
}
