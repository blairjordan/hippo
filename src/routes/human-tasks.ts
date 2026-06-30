import type { FastifyPluginAsync } from "fastify"
import { z } from "zod"

import { verifyHumanTaskToken } from "../lib/engine/human-task.js"
import { type HippoTracer } from "../lib/tracing.js"
import type { WorkflowEngine } from "../lib/workflow-engine.js"
import type { JsonValue } from "../types/json.js"

const tokenParamsSchema = z.object({
  token: z.string().min(1).optional(),
  "*": z.string().min(1).optional(),
})

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

const decisionBodySchema = z.object({
  decision: z.enum(["approve", "reject"]),
  data: jsonValueSchema.optional(),
})

const createRouteTraceAttributes = (args: {
  method: string
  operation: string
  route: string
}) => ({
  "hippo.operation": args.operation,
  "http.request.method": args.method,
  "url.route": args.route,
})

const traceRequest = <T>(
  tracer: HippoTracer,
  trace: {
    name: string
    attributes: Record<string, string | number | boolean | null | undefined>
  },
  run: () => Promise<T> | T
) => tracer.withSpan(trace, () => run())

const getTokenParam = (params: unknown) => {
  const parsed = tokenParamsSchema.parse(params)
  const token = parsed.token ?? parsed["*"]

  if (!token) {
    throw new Error("Missing human task token")
  }

  return token
}

const renderForm = (token: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hippo Approval</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; max-width: 42rem; }
      main { border: 1px solid #d1d5db; border-radius: 12px; padding: 1.5rem; }
      textarea { width: 100%; min-height: 8rem; }
      .row { display: flex; gap: 0.75rem; margin-top: 1rem; }
      button { padding: 0.75rem 1rem; border-radius: 8px; border: 0; cursor: pointer; }
      button[data-decision="approve"] { background: #14532d; color: white; }
      button[data-decision="reject"] { background: #7f1d1d; color: white; }
      pre { background: #f3f4f6; padding: 0.75rem; border-radius: 8px; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Workflow approval</h1>
      <p>Submit an approve or reject decision for this waiting workflow step.</p>
      <label for="data">Optional JSON payload</label>
      <textarea id="data" placeholder='{"reason":"looks good"}'></textarea>
      <div class="row">
        <button type="button" data-decision="approve">Approve</button>
        <button type="button" data-decision="reject">Reject</button>
      </div>
      <pre id="result" aria-live="polite"></pre>
    </main>
    <script>
      const token = ${JSON.stringify(token)};
      const result = document.getElementById("result");
      const dataField = document.getElementById("data");
      const submit = async (decision) => {
        let data;
        if (dataField.value.trim().length > 0) {
          data = JSON.parse(dataField.value);
        }

        const response = await fetch("/v1/human-tasks/" + encodeURIComponent(token), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, ...(data === undefined ? {} : { data }) }),
        });

        const body = await response.json();
        result.textContent = JSON.stringify(body, null, 2);
      };

      for (const button of document.querySelectorAll("button[data-decision]")) {
        button.addEventListener("click", () => submit(button.dataset.decision));
      }
    </script>
  </body>
</html>`

export const createHumanTaskRoutes = (args: {
  callbackSecret?: string
  callbackToleranceSeconds: number
  engine: WorkflowEngine
  tracer: HippoTracer
}): FastifyPluginAsync => async (app) => {
  app.get("/human-tasks/*", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.human_task_form",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.human_task_form",
          route: "/human-tasks/:token",
        }),
      },
      async () => {
        const token = getTokenParam(request.params)
        const claims = verifyHumanTaskToken({
          token,
          secret: args.callbackSecret,
          toleranceSeconds: args.callbackToleranceSeconds,
        })

        if (!claims) {
          throw app.httpErrors.unauthorized("Invalid or expired human task token")
        }

        reply.type("text/html; charset=utf-8")
        return renderForm(token)
      }
    )
  })

  app.post("/v1/human-tasks/*", async (request, reply) => {
    return traceRequest(
      args.tracer,
      {
        name: "hippo.http.human_task_decision",
        attributes: createRouteTraceAttributes({
          method: request.method,
          operation: "http.human_task_decision",
          route: "/v1/human-tasks/:token",
        }),
      },
      async () => {
        const token = getTokenParam(request.params)
        const claims = verifyHumanTaskToken({
          token,
          secret: args.callbackSecret,
          toleranceSeconds: args.callbackToleranceSeconds,
        })

        if (!claims) {
          throw app.httpErrors.unauthorized("Invalid or expired human task token")
        }

        const body = decisionBodySchema.parse(request.body ?? {})
        const resumed = await args.engine.resumeHumanTask({
          correlationKey: claims.correlationKey,
          decision: {
            decision: body.decision,
            ...(body.data === undefined ? {} : { data: body.data }),
          },
        })

        if (resumed.status === "missing") {
          throw app.httpErrors.notFound("Human task wait not found")
        }

        reply.code(resumed.status === "duplicate" ? 200 : 202)
        return {
          outcome: resumed.status,
          runId: resumed.run?.id ?? null,
          status: resumed.run?.status ?? null,
          currentStepKey: resumed.run?.currentStepKey ?? null,
        }
      }
    )
  })
}
