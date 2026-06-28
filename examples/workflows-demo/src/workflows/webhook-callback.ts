import { z } from "zod"
import { defineWorkflow, task, wait, end } from "@hippo/sdk"

const webhookInputSchema = z.object({
  requestId: z.string(),
  callbackUrl: z.string(),
})

export const webhookCallbackWorkflow = defineWorkflow({
  name: "webhook-callback",
  version: 1,
  title: "Webhook Ingestion & Callback Wait Workflow",
  startAt: "trigger-request",
  steps: {
    "trigger-request": task({
      input: webhookInputSchema,
      next: "wait-for-callback",
      run: async (ctx) => {
        const correlationKey = `web:${ctx.run.id}:${ctx.input.requestId}`
        console.log(`[Webhook Step 1] Dispatching external request. Expecting callback with correlationKey: "${correlationKey}"`)
        return {
          patch: { correlationKey },
        }
      },
    }),
    "wait-for-callback": wait({
      timeoutMs: 300_000, // 5 minutes timeout
      open: async (ctx) => {
        const correlationKey = String(ctx.context.correlationKey)
        return {
          correlationKey,
          payload: { status: "pending" },
        }
      },
      resume: async (ctx, payload) => {
        console.log(`[Webhook Resume] Received callback payload:`, payload)
        return {
          patch: { callbackData: payload ?? null, status: "completed" },
        }
      },
    }),
    done: end({
      label: "Webhook Flow Complete",
    }),
  },
})
