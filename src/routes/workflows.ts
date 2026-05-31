import type { FastifyPluginAsync } from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../lib/workflow-definition.js"
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

export const createWorkflowRoutes = (args: {
  engine: WorkflowEngine
  store: WorkflowStore
}): FastifyPluginAsync => async (app) => {
  app.post("/v1/workflows/:workflowName/runs", async (request, reply) => {
    const params = z.object({ workflowName: z.string().min(1) }).parse(request.params)
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

  app.get("/v1/runs/:runId", async (request) => {
    const params = z.object({ runId: z.uuid() }).parse(request.params)
    const run = await args.store.getRun(params.runId)

    if (!run) {
      throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
    }

    const events = await args.store.getRunEvents(run.id)

    return {
      run,
      events,
    }
  })

  app.post("/v1/waits/:correlationKey/resume", async (request, reply) => {
    const params = z.object({ correlationKey: z.string().min(1) }).parse(request.params)
    const body = resumeBodySchema.parse(request.body ?? {})
    const run = await args.engine.resumeWait(
      body.payload === undefined
        ? { correlationKey: params.correlationKey }
        : { correlationKey: params.correlationKey, payload: body.payload }
    )

    if (!run) {
      throw app.httpErrors.notFound(
        `Open wait "${params.correlationKey}" not found`
      )
    }

    reply.code(202)
    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.get("/v1/workflows/:workflowName/render", async (request, reply) => {
    const params = z.object({ workflowName: z.string().min(1) }).parse(request.params)

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
