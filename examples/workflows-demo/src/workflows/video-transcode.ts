import { z } from "zod"
import { defineWorkflow, end, externalSession } from "pygmyhippo-sdk"

const videoTranscodeInputSchema = z.object({
  assetId: z.string(),
  sourceUrl: z.string().url(),
  profile: z.enum(["web-720p", "web-1080p", "mobile"]).default("web-720p"),
})

export const videoTranscodeWorkflow = defineWorkflow({
  name: "video-transcode",
  version: 1,
  title: "External Video Transcode Session",
  startAt: "submit-transcode",
  steps: {
    "submit-transcode": externalSession({
      sessionKind: "video-transcode",
      next: "done",
      timeoutMs: 300_000,
      start: async (ctx) => {
        const input = videoTranscodeInputSchema.parse(ctx.input)
        const externalId = `transcode:${input.assetId}`

        console.log(
          `[Video Transcode] Submitted ${input.sourceUrl} as ${externalId} using profile ${input.profile}`
        )

        return {
          externalId,
          payload: {
            assetId: input.assetId,
            profile: input.profile,
            status: "submitted",
          },
        }
      },
      resume: async (_ctx, externalId, payload) => {
        console.log(`[Video Transcode] ${externalId} completed:`, payload)

        return {
          patch: {
            transcodeId: externalId,
            transcodeResult: payload ?? null,
            status: "completed",
          },
          output: payload ?? null,
        }
      },
    }),
    done: end({
      label: "Transcode Complete",
    }),
  },
})
