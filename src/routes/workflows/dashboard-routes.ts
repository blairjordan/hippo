import { readFile } from "fs/promises"
import { fileURLToPath } from "url"
import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../../lib/workflow-definition.js"
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
}
