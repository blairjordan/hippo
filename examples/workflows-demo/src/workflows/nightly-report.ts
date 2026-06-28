import { z } from "zod"
import { defineWorkflow, task, end } from "@hippo/sdk"

const reportInputSchema = z.object({
  reportDate: z.string().optional(),
})

export const nightlyReportWorkflow = defineWorkflow({
  name: "nightly-report",
  version: 1,
  title: "Cron-Triggered Nightly Report Workflow",
  startAt: "generate-report",
  steps: {
    "generate-report": task({
      input: reportInputSchema,
      next: "complete",
      run: async (ctx) => {
        const reportDate = ctx.input.reportDate ?? ctx.now.toISOString().slice(0, 10)
        console.log(`[Cron Workflow] Generating nightly summary report for date: ${reportDate}...`)
        
        // Mock query execution using step DB helper
        const result = await ctx.db.query("SELECT COUNT(*) as total_runs FROM workflow_runs")
        const totalRuns = (result.rows[0] as any)?.total_runs ?? 0

        console.log(`[Cron Workflow] Found ${String(totalRuns)} total runs in database.`)
        return {
          patch: { reportDate, totalRuns, generatedAt: ctx.now.toISOString() },
        }
      },
    }),
    complete: end({
      label: "Report Generated Successfully",
    }),
  },
})
