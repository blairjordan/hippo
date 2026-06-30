import type { JsonObject } from "../../types/json.js"
import type {
  FanOutFailureMode,
  FanOutJoin,
  WorkflowRunRecord,
  WorkflowWaitRecord,
} from "../../types/workflow.js"

export type FanOutWaitPayload = {
  kind: "fanOutChild"
  workflowName: string
  childRunId: string
  childIndex: number
  childCount: number
  join: FanOutJoin
  failureMode: FanOutFailureMode
}

const terminalStatuses = new Set<WorkflowRunRecord["status"]>([
  "completed",
  "failed",
  "compensation_failed",
  "exhausted_budget",
  "canceled",
])

export const fanOutFailureModeDefault: FanOutFailureMode = "collect"

export const fanOutJoinDefault: FanOutJoin = {
  kind: "all",
}

export const buildFanOutChildCorrelationKey = (args: {
  parentRunId: string
  stepKey: string
  childIndex: number
}) => `child:${args.parentRunId}:${args.stepKey}:${String(args.childIndex)}`

export const buildFanOutChildIdempotencyKey = (args: {
  parentRunId: string
  stepKey: string
  childIndex: number
}) => `fanout:${args.parentRunId}:${args.stepKey}:${String(args.childIndex)}`

export const isFanOutWaitPayload = (value: unknown): value is FanOutWaitPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const join = record["join"]

  const hasValidJoin =
    !!join &&
    typeof join === "object" &&
    !Array.isArray(join) &&
    (((join as Record<string, unknown>)["kind"] === "all") ||
      ((join as Record<string, unknown>)["kind"] === "quorum" &&
        typeof (join as Record<string, unknown>)["count"] === "number"))

  return (
    record["kind"] === "fanOutChild" &&
    typeof record["workflowName"] === "string" &&
    typeof record["childRunId"] === "string" &&
    typeof record["childIndex"] === "number" &&
    typeof record["childCount"] === "number" &&
    hasValidJoin &&
    (record["failureMode"] === "collect" || record["failureMode"] === "fail-fast")
  )
}

export const getFanOutWaitPayload = (waits: WorkflowWaitRecord[]) => {
  for (const wait of waits) {
    if (isFanOutWaitPayload(wait.payload)) {
      return wait.payload
    }
  }

  return null
}

export const groupFanOutWaitsByChildRunId = (waits: WorkflowWaitRecord[]) =>
  new Map(
    waits.flatMap((wait) =>
      isFanOutWaitPayload(wait.payload) ? [[wait.payload.childRunId, wait] as const] : []
    )
  )

export const sortFanOutChildRuns = (args: {
  childRuns: WorkflowRunRecord[]
  waits: WorkflowWaitRecord[]
}) => {
  const childIndexByRunId = new Map(
    args.waits.flatMap((wait) =>
      isFanOutWaitPayload(wait.payload)
        ? [[wait.payload.childRunId, wait.payload.childIndex] as const]
        : []
    )
  )

  return [...args.childRuns].sort((left, right) => {
    const leftIndex = childIndexByRunId.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = childIndexByRunId.get(right.id) ?? Number.MAX_SAFE_INTEGER

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    return left.createdAt.getTime() - right.createdAt.getTime()
  })
}

export const isTerminalChildRun = (run: WorkflowRunRecord) =>
  terminalStatuses.has(run.status)

export const getFanOutJoinState = (args: {
  childRuns: WorkflowRunRecord[]
  waits: WorkflowWaitRecord[]
}) => {
  const metadata = getFanOutWaitPayload(args.waits)

  if (!metadata) {
    return {
      ready: false,
      childCount: 0,
      terminalCount: 0,
      successfulCount: 0,
      hasFailure: false,
      failureMode: fanOutFailureModeDefault,
      join: fanOutJoinDefault,
    }
  }

  const waitsByChildRunId = groupFanOutWaitsByChildRunId(args.waits)
  const relevantRuns = args.childRuns.filter((run) => waitsByChildRunId.has(run.id))
  const terminalRuns = relevantRuns.filter(isTerminalChildRun)
  const successfulCount = terminalRuns.filter((run) => run.status === "completed").length
  const hasFailure =
    terminalRuns.some((run) => run.status !== "completed") ||
    args.waits.some((wait) => wait.status === "expired")

  const ready =
    metadata.join.kind === "all"
      ? terminalRuns.length === metadata.childCount
      : successfulCount >= metadata.join.count ||
        terminalRuns.length === metadata.childCount

  return {
    ready,
    childCount: metadata.childCount,
    terminalCount: terminalRuns.length,
    successfulCount,
    hasFailure,
    failureMode: metadata.failureMode,
    join: metadata.join,
  }
}

export const createFanOutWaitPayload = (args: {
  workflowName: string
  childRunId: string
  childIndex: number
  childCount: number
  join: FanOutJoin
  failureMode: FanOutFailureMode
}): JsonObject => ({
  kind: "fanOutChild",
  workflowName: args.workflowName,
  childRunId: args.childRunId,
  childIndex: args.childIndex,
  childCount: args.childCount,
  join: args.join,
  failureMode: args.failureMode,
})
