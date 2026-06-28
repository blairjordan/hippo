import { z } from "zod"
import { defineWorkflow, task, signal, end } from "@hippo/sdk"

const approvalInputSchema = z.object({
  documentId: z.string(),
  approverId: z.string(),
})

export const approvalFlowWorkflow = defineWorkflow({
  name: "approval-flow",
  version: 1,
  title: "Long-Running Approval Workflow with Timeout",
  startAt: "request-approval",
  steps: {
    "request-approval": task({
      input: approvalInputSchema,
      next: "wait-for-approval",
      run: async (ctx) => {
        console.log(`[Approval Flow] Requesting approval for document ${String(ctx.input.documentId)} from approver ${String(ctx.input.approverId)}`)
        return {
          patch: { approved: false },
        }
      },
    }),
    "wait-for-approval": signal({
      signal: "approve",
      timeoutMs: 30000, // 30 seconds timeout
      next: "approve-document",
      resume: async (ctx, payload) => {
        console.log(`[Approval Resume] Signal received! Payload:`, payload)
        return {
          patch: {
            approved: true,
            approvedBy: (payload as any)?.approver || ctx.input.approverId,
            approvedAt: ctx.now.toISOString(),
          },
        }
      },
    }),
    "approve-document": task({
      input: approvalInputSchema,
      next: "complete",
      run: async (ctx) => {
        console.log(`[Approval Flow] Document ${String(ctx.input.documentId)} approved successfully!`)
        return {}
      },
    }),
    complete: end({
      label: "Approval Processing Complete",
    }),
  },
})
