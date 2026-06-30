import { z } from "zod"

import type { JsonObject, JsonValue } from "../../types/json.js"

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema
)

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const optionalQueryText = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).max(200).optional()
)

export const startRunBodySchema = z.object({
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
})

export const resumeBodySchema = z.object({
  payload: jsonValueSchema.optional(),
})

export const externalHeartbeatBodySchema = z.object({
  progress: z.number().min(0).max(1).optional(),
  message: z.string().min(1).max(1_000).optional(),
  usage: z
    .object({
      resource: z.string().min(1),
      amount: z.number(),
      costUsd: z.number().optional(),
    })
    .optional(),
})

export const externalSessionEventsBodySchema = z.object({
  events: z
    .array(
      z.object({
        type: z.string().trim().min(1).max(200),
        data: jsonValueSchema,
      })
    )
    .min(1)
    .max(100),
})

export const operatorListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  afterUpdatedAt: z.string().optional(),
  afterId: z.uuid().optional(),
})

export const operatorRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  parentRunId: z.uuid().optional(),
  search: optionalQueryText,
  status: z
    .enum([
      "queued",
      "running",
      "waiting",
      "completed",
      "failed",
      "compensation_failed",
      "exhausted_budget",
      "canceled",
    ])
    .optional(),
  taskQueue: optionalQueryText,
  workflowName: optionalQueryText,
  afterUpdatedAt: z.string().optional(),
  afterId: z.uuid().optional(),
})

export const stuckRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  olderThanMs: z.coerce.number().int().positive().default(60_000),
  afterUpdatedAt: z.string().optional(),
  afterId: z.uuid().optional(),
})

export const runStreamQuerySchema = z.object({
  afterEventId: z.coerce.number().int().nonnegative().default(0),
})

export const runContextQuerySchema = z.object({
  keys: z.string().min(1).optional(),
})

export const runIdParamsSchema = z.object({
  runId: z.uuid(),
})

export const workflowNameParamsSchema = z.object({
  workflowName: z.string().min(1),
})

export const correlationKeyParamsSchema = z.object({
  correlationKey: z.string().min(1),
})

export const externalSessionParamsSchema = z.object({
  externalId: z.string().min(1),
})

export const signalParamsSchema = z.object({
  runId: z.uuid(),
  signalName: z.string().min(1),
})

export const cancelRunBodySchema = z.object({
  mode: z.enum(["graceful", "hard"]).default("graceful"),
  reason: z.string().min(1).max(1_000).optional(),
})

export const createScheduleBodySchema = z.object({
  workflowName: z.string().min(1),
  cronExpression: z.string().min(1),
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
})

export const reconcileBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(1_000).default(100),
})

export const rewindRunBodySchema = z.object({
  toAttemptId: z.uuid(),
})

export const forkRunBodySchema = z.object({
  fromAttemptId: z.uuid(),
})

export const terminalRunStatuses = new Set([
  "completed",
  "failed",
  "compensation_failed",
  "exhausted_budget",
  "canceled",
])
