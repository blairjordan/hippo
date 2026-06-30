import type { JsonObject, JsonValue } from "./json.js"

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "compensation_failed"
  | "exhausted_budget"
  | "canceled"

export type WorkflowCancelMode = "graceful" | "hard"

export type StepAttemptStatus = "started" | "completed" | "failed"

export type StepAttemptKind = "forward" | "compensate"

export type WorkflowRunRecord = {
  id: string
  parentRunId: string | null
  parentStepKey: string | null
  continuedFromRunId: string | null
  branchedFromRunId: string | null
  branchedFromAttemptRunId: string | null
  branchedFromAttemptId: string | null
  supersededByRunId: string | null
  definitionName: string
  definitionVersion: number
  taskQueue: string
  priority: number
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
  traceContext?: string | null
}

export type WorkflowEventRecord = {
  id: number
  runId: string
  stepKey: string | null
  eventType: string
  payload: JsonObject
  createdAt: Date
}

export type WorkflowUsageRecord = {
  id: string
  runId: string
  stepAttemptId: string | null
  resource: string
  amount: number
  costUsd: number | null
  dimension: string | null
  recordedAt: Date
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
  externalSessionId: string | null
  externalSessionKind: string | null
}

export type WorkflowStepAttemptRecord = {
  id: string
  runId: string
  stepKey: string
  kind: StepAttemptKind
  stepSeq: number
  attempt: number
  status: StepAttemptStatus
  contextBefore: JsonObject
  input: JsonObject
  output: JsonValue | null
  error: JsonValue | null
  startedAt: Date
  lastHeartbeatAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  traceContext?: string | null
  externalSessionId?: string | null
  externalSessionKind?: string | null
}

export type RetryPolicy = {
  maxAttempts: number
  initialBackoffMs?: number
  maxBackoffMs?: number
  backoffMultiplier?: number
  jitterMs?: number
  nonRetryableErrorTags?: string[]
}

export type WorkflowUsageInput = {
  resource: string
  amount: number
  costUsd?: number
  dimension?: string
}

export type WorkflowBudget = {
  costUsd?: number
  resources?: Record<string, number>
}

export type TaskStepResult = {
  patch?: JsonObject
  transition?: string
  output?: JsonValue
  continueAsNew?: {
    payload: JsonObject
    taskQueue?: string
    priority?: number
  }
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

export type HumanTaskDecision = {
  decision: "approve" | "reject"
  data?: JsonValue
}

export type HumanTaskOpenResult = {
  prompt?: JsonValue
}

export type HumanTaskTimeoutResult = {
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

export type WorkflowScheduleRecord = {
  id: string
  workflowName: string
  cronExpression: string
  payload: JsonObject
  taskQueue: string
  priority: number
  active: boolean
  nextFireAt: Date
  createdAt: Date
  updatedAt: Date
}

export type WorkflowOutboxRecord = {
  id: string
  runId: string | null
  topic: string
  payload: JsonObject
  availableAt: Date
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type WorkflowStepDatabase = {
  query<T extends object = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[] }>
}

export type WorkflowStepOutbox = {
  enqueue: (input: {
    topic: string
    payload: JsonObject
    availableAt?: Date
  }) => Promise<void>
}

export type StepExecutionKV = {
  get: (key: string) => Promise<JsonValue | null>
  set: (key: string, value: JsonValue) => Promise<void>
  delete: (key: string) => Promise<void>
}

export type StepExecutionContext = {
  run: WorkflowRunRecord & { kv: StepExecutionKV }
  input: JsonObject
  context: JsonObject
  now: Date
  attempt: number
  idempotencyKey: string
  heartbeat: () => Promise<boolean>
  emit: (event: { type: string; data: JsonValue }) => Promise<void>
  recordUsage: (usage: WorkflowUsageInput) => Promise<void>
  db: WorkflowStepDatabase
  outbox: WorkflowStepOutbox
  transactional: boolean
  kv: StepExecutionKV
}

export type CompensationHandler = (
  context: StepExecutionContext,
  cause: JsonValue | null
) => Promise<void> | void

export type CompensationDefinition = {
  run: CompensationHandler
  retry?: RetryPolicy
}

export type TaskStepDefinition = {
  kind: "task"
  label?: string
  next?: string
  transitions?: Record<string, string>
  retry?: RetryPolicy
  compensate?: CompensationHandler | CompensationDefinition
  timeoutMs?: number
  transactional?: boolean
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

export type HumanTaskStepDefinition = {
  kind: "humanTask"
  label?: string
  next?: string
  transitions?: Record<string, string>
  timeoutMs: number
  open: (
    context: StepExecutionContext & {
      approvalToken: string
      approvalUrl: string
      formUrl: string
    }
  ) => Promise<HumanTaskOpenResult> | HumanTaskOpenResult
  resume: (
    context: StepExecutionContext,
    decision: HumanTaskDecision
  ) => Promise<WaitStepResumeResult> | WaitStepResumeResult
  timeout: HumanTaskTimeoutResult
}

export type ChildStepResult = {
  patch?: JsonObject
  transition?: string
  output?: JsonValue
}

export type FanOutChildInput = {
  workflow: string
  input: JsonObject
}

export type FanOutJoin =
  | { kind: "all" }
  | { kind: "quorum"; count: number }

export type FanOutFailureMode = "collect" | "fail-fast"

export type ChildStepDefinition = {
  kind: "child"
  label?: string
  workflow: string
  next?: string
  transitions?: Record<string, string>
  input: (
    context: StepExecutionContext
  ) => Promise<JsonObject> | JsonObject
  resume: (
    context: StepExecutionContext,
    childRun: WorkflowRunRecord
  ) => Promise<ChildStepResult> | ChildStepResult
}

export type FanOutStepDefinition = {
  kind: "fanOut"
  label?: string
  next?: string
  transitions?: Record<string, string>
  timeoutMs?: number
  join?: FanOutJoin
  failureMode?: FanOutFailureMode
  children: (
    context: StepExecutionContext
  ) => Promise<FanOutChildInput[]> | FanOutChildInput[]
  resume: (
    context: StepExecutionContext,
    childRuns: WorkflowRunRecord[]
  ) => Promise<ChildStepResult> | ChildStepResult
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

export type ExternalSessionStartResult = {
  externalId: string
  payload?: JsonValue
}

export type ExternalSessionStepDefinition = {
  kind: "externalSession"
  label?: string
  sessionKind: string
  next?: string
  transitions?: Record<string, string>
  timeoutMs: number
  retry?: RetryPolicy
  start: (
    context: StepExecutionContext
  ) => Promise<ExternalSessionStartResult> | ExternalSessionStartResult
  resume: (
    context: StepExecutionContext,
    externalId: string,
    payload: JsonValue | undefined
  ) => Promise<WaitStepResumeResult> | WaitStepResumeResult
  cancel?: (
    context: StepExecutionContext,
    externalId: string
  ) => Promise<void> | void
}

export type WorkflowStepDefinition =
  | TaskStepDefinition
  | WaitStepDefinition
  | SignalStepDefinition
  | HumanTaskStepDefinition
  | ChildStepDefinition
  | FanOutStepDefinition
  | SleepStepDefinition
  | EndStepDefinition
  | ExternalSessionStepDefinition

export type WorkflowDefinition = {
  name: string
  version: number
  title?: string
  startAt: string
  steps: Record<string, WorkflowStepDefinition>
  budget?: WorkflowBudget
  queries?: Record<string, (context: JsonObject) => JsonValue>
}
