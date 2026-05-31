import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  SleepStepDefinition,
  StepExecutionContext,
  TaskStepResult,
  WaitStepResumeResult,
  WorkflowDefinition,
  WorkflowRunRecord,
} from "../types/workflow.js"
import type { HippoMetrics } from "./metrics.js"
import { LostLeaseError, type WorkflowStore } from "./workflow-store.js"

const asErrorPayload = (error: unknown): JsonObject => ({
  message: error instanceof Error ? error.message : "Unknown error",
  ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
})

const mergeContext = (left: JsonObject, right?: JsonObject) => ({
  ...left,
  ...(right ?? {}),
})

const getDefinition = (
  definitions: Map<string, WorkflowDefinition>,
  name: string
) => {
  const definition = definitions.get(name)

  if (!definition) {
    return null
  }

  return definition
}

const requireDefinition = (
  definitions: Map<string, WorkflowDefinition>,
  name: string
) => {
  const definition = getDefinition(definitions, name)

  if (!definition) {
    throw new Error(`Workflow definition "${name}" is not registered`)
  }

  return definition
}

const getStep = (definition: WorkflowDefinition, stepKey: string) => {
  const step = definition.steps[stepKey]

  if (!step) {
    throw new Error(
      `Workflow "${definition.name}" is missing step "${stepKey}"`
    )
  }

  return step
}

const createExecutionContext = (args: {
  run: WorkflowRunRecord
  attempt: number
  stepKey: string
}): StepExecutionContext => ({
  run: args.run,
  input: args.run.input,
  context: args.run.context,
  now: new Date(),
  attempt: args.attempt,
  idempotencyKey: `${args.run.id}:${args.stepKey}`,
})

const createStepInput = (
  run: WorkflowRunRecord,
  stepKey: string
): JsonObject => ({
  workflow: run.definitionName,
  step: stepKey,
  input: run.input,
  context: run.context,
})

const resolveTaskTransition = (
  result: TaskStepResult,
  fallback: string | undefined
) => result.transition ?? fallback ?? null

const resolveSleepUntil = (
  step: SleepStepDefinition,
  context: StepExecutionContext
) => {
  const resolved =
    typeof step.until === "function" ? step.until(context) : step.until

  if (resolved instanceof Date) {
    return resolved
  }

  if (typeof resolved === "number") {
    return new Date(context.now.getTime() + resolved)
  }

  return new Date(resolved)
}

const getRetryAvailableAt = (attempt: number, backoffMs = 1_000) =>
  new Date(Date.now() + backoffMs * attempt)

const continueRun = async (args: {
  definitions: Map<string, WorkflowDefinition>
  metrics: HippoMetrics
  store: WorkflowStore
  workerId: string
  run: WorkflowRunRecord
}) => {
  let activeRun = args.run
  const definition = requireDefinition(args.definitions, activeRun.definitionName)

  while (activeRun.currentStepKey) {
    const stepKey = activeRun.currentStepKey
    const step = getStep(definition, stepKey)

    if (step.kind === "end") {
      const completed = await args.store.completeRun({
        runId: activeRun.id,
        stepKey,
        workerId: args.workerId,
        context: activeRun.context,
        result: activeRun.context,
      })

      args.metrics.runsCompleted.inc({ workflow: definition.name })
      return completed
    }

    if (step.kind === "sleep") {
      const availableAt = resolveSleepUntil(
        step,
        createExecutionContext({
          run: activeRun,
          attempt: 0,
          stepKey,
        })
      )

      activeRun = await args.store.scheduleSleep({
        runId: activeRun.id,
        stepKey,
        workerId: args.workerId,
        nextStepKey: step.next,
        availableAt,
      })
      return activeRun
    }

    const attempt = await args.store.beginStepAttempt({
      runId: activeRun.id,
      stepKey,
      input: createStepInput(activeRun, stepKey),
    })
    const executionContext = createExecutionContext({
      run: activeRun,
      attempt: attempt.attempt,
      stepKey,
    })

    try {
      if (step.kind === "wait") {
        const waitResult = await step.open(executionContext)
        activeRun = await args.store.openWait({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          context: activeRun.context,
          correlationKey: waitResult.correlationKey,
          payload: waitResult.payload ?? null,
          output: waitResult.payload ?? null,
        })

        args.metrics.stepAttempts.inc({
          workflow: definition.name,
          step: stepKey,
          status: "completed",
        })
        args.metrics.waitOpens.set(await args.store.countOpenWaits())
        return activeRun
      }

      const result = await step.run(executionContext)
      const nextStepKey = resolveTaskTransition(result, step.next)

      if (!nextStepKey) {
        throw new Error(
          `Task step "${stepKey}" in workflow "${definition.name}" did not resolve a next step`
        )
      }

      activeRun = await args.store.advanceTaskStep({
        runId: activeRun.id,
        stepKey,
        workerId: args.workerId,
        attemptId: attempt.id,
        nextStepKey,
        context: mergeContext(activeRun.context, result.patch),
        output: result.output ?? null,
      })

      args.metrics.stepAttempts.inc({
        workflow: definition.name,
        step: stepKey,
        status: "completed",
      })
    } catch (error) {
      if (error instanceof LostLeaseError) {
        return null
      }

      const retryPolicy = step.kind === "task" ? step.retry : undefined
      const canRetry =
        retryPolicy !== undefined && attempt.attempt < retryPolicy.maxAttempts

      if (canRetry) {
        activeRun = await args.store.scheduleRetry({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          availableAt: getRetryAvailableAt(
            attempt.attempt,
            retryPolicy.backoffMs
          ),
          error: asErrorPayload(error),
        })
      } else {
        activeRun = await args.store.failRun({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          error: asErrorPayload(error),
        })

        args.metrics.runsFailed.inc({
          workflow: definition.name,
          step: stepKey,
        })
      }

      args.metrics.stepAttempts.inc({
        workflow: definition.name,
        step: stepKey,
        status: "failed",
      })

      return activeRun
    }
  }

  return activeRun
}

export const createWorkflowEngine = (args: {
  definitions: WorkflowDefinition[]
  metrics: HippoMetrics
  store: WorkflowStore
}) => {
  const definitions = new Map(
    args.definitions.map((definition) => [definition.name, definition])
  )

  const startRun = async (input: {
    workflowName: string
    payload: JsonObject
  }) => {
    const definition = requireDefinition(definitions, input.workflowName)

    const run = await args.store.startRun({
      definitionName: definition.name,
      definitionVersion: definition.version,
      input: input.payload,
      currentStepKey: definition.startAt,
    })

    args.metrics.runsStarted.inc({ workflow: definition.name })
    return run
  }

  const tick = async (workerId: string, leaseMs: number) => {
    const claimedRun = await args.store.claimNextRunnableRun({ workerId, leaseMs })

    if (!claimedRun) {
      return null
    }

    args.metrics.claims.inc()
    return continueRun({
      definitions,
      metrics: args.metrics,
      store: args.store,
      workerId,
      run: claimedRun,
    })
  }

  const resumeWait = async (input: {
    correlationKey: string
    payload?: JsonValue
  }) =>
    args.store.resumeWait({
      correlationKey: input.correlationKey,
      payload: input.payload,
      resume: async (run, wait) => {
        const definition = requireDefinition(definitions, run.definitionName)
        const step = getStep(definition, wait.stepKey)

        if (step.kind !== "wait") {
          throw new Error(
            `Step "${wait.stepKey}" in workflow "${definition.name}" is not resumable`
          )
        }

        const result: WaitStepResumeResult = await step.resume(
          createExecutionContext({
            run,
            attempt: 0,
            stepKey: wait.stepKey,
          }),
          input.payload
        )
        const nextStepKey = result.transition ?? step.next

        if (!nextStepKey) {
          throw new Error(
            `Wait step "${wait.stepKey}" in workflow "${definition.name}" did not resolve a next step`
          )
        }

        return {
          nextStepKey,
          context: mergeContext(run.context, result.patch),
          output: result.output ?? null,
        }
      },
    })

  return {
    getWorkflow: (workflowName: string) =>
      requireDefinition(definitions, workflowName),
    hasWorkflow: (workflowName: string) => getDefinition(definitions, workflowName) !== null,
    resumeWait,
    startRun,
    tick,
  }
}

export type WorkflowEngine = ReturnType<typeof createWorkflowEngine>
