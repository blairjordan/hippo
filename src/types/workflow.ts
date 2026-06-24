import type { JsonObject, JsonValue } from "./json.js"

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "canceled"

export type WorkflowCancelMode = "graceful" | "hard"

export type StepAttemptStatus = "started" | "completed" | "failed"

export type WorkflowRunRecord = {
  id: string
  parentRunId: string | null
  definitionName: string
  definitionVersion: number
  status: WorkflowRunStatus
  currentStepKey: string | null
  input: JsonObject
  context: JsonObject
  result: JsonValue | null
  error: JsonValue | null
  leaseOwner: string | null
  leaseExpiresAt: Date | null
  cancelRequestedAt: Date | null
  cancelMode: WorkflowCancelMode | null
  availableAt: Date
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

export type WorkflowEventRecord = {
  id: number
  runId: string
  stepKey: string | null
  eventType: string
  payload: JsonObject
  createdAt: Date
}

export type WorkflowWaitRecord = {
  id: string
  runId: string
  stepKey: string
  correlationKey: string
  status: "open" | "resumed" | "expired" | "canceled"
  payload: JsonValue | null
  resumePayload: JsonValue | null
  resumeOutput: JsonValue | null
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  resumedAt: Date | null
}

export type WorkflowStepAttemptRecord = {
  id: string
  runId: string
  stepKey: string
  attempt: number
  status: StepAttemptStatus
  input: JsonObject
  output: JsonValue | null
  error: JsonValue | null
  startedAt: Date
  lastHeartbeatAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type RetryPolicy = {
  maxAttempts: number
  backoffMs?: number
  nonRetryableErrorTags?: string[]
}

export type TaskStepResult = {
  patch?: JsonObject
  transition?: string
  output?: JsonValue
}

export type WaitStepOpenResult = {
  correlationKey: string
  payload?: JsonValue
}

export type WaitStepResumeResult = {
  patch?: JsonObject
  transition?: string
  output?: JsonValue
}

export type SignalRecord = {
  id: string
  runId: string
  signalName: string
  payload: JsonValue | null
  consumedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type StepExecutionContext = {
  run: WorkflowRunRecord
  input: JsonObject
  context: JsonObject
  now: Date
  attempt: number
  idempotencyKey: string
  heartbeat: () => Promise<boolean>
}

export type TaskStepDefinition = {
  kind: "task"
  label?: string
  next?: string
  transitions?: Record<string, string>
  retry?: RetryPolicy
  timeoutMs?: number
  run: (context: StepExecutionContext) => Promise<TaskStepResult> | TaskStepResult
}

export type WaitStepDefinition = {
  kind: "wait"
  label?: string
  next?: string
  transitions?: Record<string, string>
  timeoutMs: number
  open: (
    context: StepExecutionContext
  ) => Promise<WaitStepOpenResult> | WaitStepOpenResult
  resume: (
    context: StepExecutionContext,
    payload: JsonValue | undefined
  ) => Promise<WaitStepResumeResult> | WaitStepResumeResult
}

export type SignalStepDefinition = {
  kind: "signal"
  label?: string
  signal: string
  next?: string
  transitions?: Record<string, string>
  timeoutMs: number
  resume: (
    context: StepExecutionContext,
    payload: JsonValue | undefined
  ) => Promise<WaitStepResumeResult> | WaitStepResumeResult
}

export type SleepStepDefinition = {
  kind: "sleep"
  label?: string
  next: string
  until:
    | Date
    | string
    | number
    | ((context: StepExecutionContext) => Date | string | number)
}

export type EndStepDefinition = {
  kind: "end"
  label?: string
}

export type WorkflowStepDefinition =
  | TaskStepDefinition
  | WaitStepDefinition
  | SignalStepDefinition
  | SleepStepDefinition
  | EndStepDefinition

export type WorkflowDefinition = {
  name: string
  version: number
  title?: string
  startAt: string
  steps: Record<string, WorkflowStepDefinition>
}
