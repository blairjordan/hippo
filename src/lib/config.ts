import { z } from "zod"

const baseEnvSchema = z.object({
  DATABASE_URL: z.url(),
  HIPPO_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
  HIPPO_HOST: z.string().default("127.0.0.1"),
  HIPPO_PORT: z.coerce.number().int().positive().default(3000),
  HIPPO_WORKER_ID: z.string().default("hippo-worker"),
  HIPPO_TASK_QUEUES: z.string().min(1).default("default"),
  HIPPO_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  HIPPO_LEASE_MS: z.coerce.number().int().positive().default(15_000),
  HIPPO_RECOVERY_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
  HIPPO_SCHEDULE_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  HIPPO_OUTBOX_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
  HIPPO_NOTIFICATION_CHANNEL: z.string().min(1).default("hippo_workflow_runnable"),
  HIPPO_API_TOKEN: z.string().min(1).optional(),
  HIPPO_CALLBACK_SECRET: z.string().min(1).optional(),
  HIPPO_CALLBACK_TOLERANCE_SECONDS: z.coerce.number().int().positive().default(300),
})

const envSchema = baseEnvSchema.superRefine((value, context) => {
  if (value.HIPPO_ENV === "dev") {
    return
  }

  if (!value.HIPPO_API_TOKEN) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HIPPO_API_TOKEN"],
      message: "HIPPO_API_TOKEN is required when HIPPO_ENV is staging or prod",
    })
  }

  if (!value.HIPPO_CALLBACK_SECRET) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["HIPPO_CALLBACK_SECRET"],
      message:
        "HIPPO_CALLBACK_SECRET is required when HIPPO_ENV is staging or prod",
    })
  }
})

export type HippoConfig = z.infer<typeof baseEnvSchema>

export const getConfig = (): HippoConfig => envSchema.parse(process.env)
