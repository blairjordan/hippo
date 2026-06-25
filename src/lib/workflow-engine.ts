import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  ChildStepResult,
  CompensationDefinition,
  CompensationHandler,
  SleepStepDefinition,
  StepExecutionContext,
  TaskStepDefinition,
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

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })

type DefinitionRegistry = {
  byVersion: Map<string, WorkflowDefinition>
  latestByName: Map<string, WorkflowDefinition>
}

const getDefinitionVersionKey = (name: string, version: number) =>
  `${name}@${String(version)}`

const createDefinitionRegistry = (definitions: WorkflowDefinition[]): DefinitionRegistry => {
  const byVersion = new Map<string, WorkflowDefinition>()
  const latestByName = new Map<string, WorkflowDefinition>()

  for (const definition of definitions) {
    const versionKey = getDefinitionVersionKey(definition.name, definition.version)

    if (byVersion.has(versionKey)) {
      throw new Error(
        `Duplicate workflow definition registered for "${definition.name}" version ${String(definition.version)}`
      )
    }

    byVersion.set(versionKey, definition)

    const latest = latestByName.get(definition.name)

    if (!latest || definition.version > latest.version) {
      latestByName.set(definition.name, definition)
    }
  }

  return {
    byVersion,
    latestByName,
  }
}

const getDefinition = (
  registry: DefinitionRegistry,
  name: string,
  version?: number
) => {
  if (version !== undefined) {
    return registry.byVersion.get(getDefinitionVersionKey(name, version)) ?? null
  }

  return registry.latestByName.get(name) ?? null
}

const requireDefinition = (
  registry: DefinitionRegistry,
  name: string,
  version?: number
) => {
  const definition = getDefinition(registry, name, version)

  if (!definition) {
    throw new Error(
      version === undefined
        ? `Workflow definition "${name}" is not registered`
        : `Workflow definition "${name}" version ${String(version)} is not registered`
    )
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
  heartbeat: () => Promise<boolean>
  db: StepExecutionContext["db"]
  outbox: StepExecutionContext["outbox"]
  transactional: boolean
}): StepExecutionContext => ({
  run: args.run,
  input: args.run.input,
  context: args.run.context,
  now: new Date(),
  attempt: args.attempt,
  idempotencyKey: `${args.run.id}:${args.stepKey}`,
  heartbeat: args.heartbeat,
  db: args.db,
  outbox: args.outbox,
  transactional: args.transactional,
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

const getStepExpiresAt = (timeoutMs: number, now: Date) =>
  new Date(now.getTime() + timeoutMs)

const defaultRetryBackoff = {
  initialBackoffMs: 1_000,
  maxBackoffMs: 60_000,
  backoffMultiplier: 2,
  jitterMs: 250,
} as const

const defaultCompensationRetryPolicy = {
  maxAttempts: 1,
  initialBackoffMs: 250,
  maxBackoffMs: 1_000,
  backoffMultiplier: 2,
  jitterMs: 50,
} as const

const getRetryAvailableAt = (args: {
  attempt: number
  initialBackoffMs?: number
  maxBackoffMs?: number
  backoffMultiplier?: number
  jitterMs?: number
}) => {
  const initialBackoffMs =
    args.initialBackoffMs ?? defaultRetryBackoff.initialBackoffMs
  const maxBackoffMs = args.maxBackoffMs ?? defaultRetryBackoff.maxBackoffMs
  const backoffMultiplier =
    args.backoffMultiplier ?? defaultRetryBackoff.backoffMultiplier
  const jitterMs =
    args.jitterMs ??
    (initialBackoffMs === 0 ? 0 : defaultRetryBackoff.jitterMs)
  const exponentialDelay =
    initialBackoffMs * backoffMultiplier ** Math.max(0, args.attempt - 1)
  const cappedDelay = Math.min(exponentialDelay, maxBackoffMs)
  const jitterOffset =
    jitterMs <= 0 ? 0 : Math.round((Math.random() * 2 - 1) * jitterMs)
  const jitteredDelay = Math.min(
    maxBackoffMs,
    Math.max(0, cappedDelay + jitterOffset)
  )

  return new Date(Date.now() + jitteredDelay)
}

const isTerminalStatus = (status: WorkflowRunRecord["status"]) =>
  status === "completed" ||
  status === "failed" ||
  status === "compensation_failed" ||
  status === "canceled"

const createRetryDelayInput = (retryPolicy: {
  initialBackoffMs?: number
  maxBackoffMs?: number
  backoffMultiplier?: number
  jitterMs?: number
}) => ({
  ...(retryPolicy.initialBackoffMs === undefined
    ? {}
    : { initialBackoffMs: retryPolicy.initialBackoffMs }),
  ...(retryPolicy.maxBackoffMs === undefined
    ? {}
    : { maxBackoffMs: retryPolicy.maxBackoffMs }),
  ...(retryPolicy.backoffMultiplier === undefined
    ? {}
    : { backoffMultiplier: retryPolicy.backoffMultiplier }),
  ...(retryPolicy.jitterMs === undefined
    ? {}
    : { jitterMs: retryPolicy.jitterMs }),
})

const getErrorTag = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return null
  }

  const tagged = error as { tag?: unknown; code?: unknown; name?: unknown }

  if (typeof tagged.tag === "string") {
    return tagged.tag
  }

  if (typeof tagged.code === "string") {
    return tagged.code
  }

  if (typeof tagged.name === "string") {
    return tagged.name
  }

  return null
}

const getCompensationDefinition = (
  step: TaskStepDefinition
): CompensationDefinition | null => {
  if (!step.compensate) {
    return null
  }

  if (typeof step.compensate === "function") {
    return {
      run: step.compensate as CompensationHandler,
      retry: defaultCompensationRetryPolicy,
    }
  }

  return {
    ...step.compensate,
    retry: {
      ...defaultCompensationRetryPolicy,
      ...(step.compensate.retry ?? {}),
    },
  }
}

const observeRunDuration = (args: {
  metrics: HippoMetrics
  run: WorkflowRunRecord
  status: "completed" | "failed"
}) => {
  const durationSeconds =
    (Date.now() - args.run.createdAt.getTime()) / 1_000

  args.metrics.runDurationSeconds.observe(
    {
      workflow: args.run.definitionName,
      status: args.status,
    },
    durationSeconds
  )
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  label: string
) => {
  if (timeoutMs === undefined) {
    return promise
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${String(timeoutMs)}ms`))
    }, timeoutMs)

    void promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

const continueRun = async (args: {
  definitions: DefinitionRegistry
  metrics: HippoMetrics
  store: WorkflowStore
  workerId: string
  run: WorkflowRunRecord
}) => {
  let activeRun = args.run
  const definition = requireDefinition(
    args.definitions,
    activeRun.definitionName,
    activeRun.definitionVersion
  )

  while (activeRun.currentStepKey) {
    const stepKey = activeRun.currentStepKey
    const step = getStep(definition, stepKey)
    const stepBindings = {
      db: {
        query: args.store.queryStepDatabase,
      },
      outbox: {
        enqueue: async (input: {
          topic: string
          payload: JsonObject
          availableAt?: Date
        }) => {
          await args.store.enqueueOutbox({
            runId: activeRun.id,
            topic: input.topic,
            payload: input.payload,
            ...(input.availableAt === undefined
              ? {}
              : { availableAt: input.availableAt }),
          })
        },
      },
    }

    if (
      activeRun.cancelRequestedAt !== null &&
      activeRun.cancelMode === "graceful"
    ) {
      const canceled = await args.store.cancelRunAtBoundary({
        runId: activeRun.id,
        stepKey,
        workerId: args.workerId,
        mode: activeRun.cancelMode,
      })

      return canceled
    }

    if (step.kind === "end") {
      const completed = await args.store.completeRun({
        runId: activeRun.id,
        stepKey,
        workerId: args.workerId,
        context: activeRun.context,
        result: activeRun.context,
      })

      args.metrics.runsCompleted.inc({ workflow: definition.name })
      observeRunDuration({
        metrics: args.metrics,
        run: completed,
        status: "completed",
      })
      return completed
    }

    if (step.kind === "sleep") {
      const availableAt = resolveSleepUntil(
        step,
        createExecutionContext({
          run: activeRun,
          attempt: 0,
          stepKey,
          heartbeat: async () => false,
          db: stepBindings.db,
          outbox: stepBindings.outbox,
          transactional: false,
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
      heartbeat: () =>
        args.store.extendLease({
          runId: activeRun.id,
          stepKey,
          attemptId: attempt.id,
          workerId: args.workerId,
          leaseMs: 15_000,
        }),
      db: stepBindings.db,
      outbox: stepBindings.outbox,
      transactional: false,
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
          expiresAt: getStepExpiresAt(step.timeoutMs, executionContext.now),
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

      if (step.kind === "signal") {
        const consumeSignal = () =>
          args.store.consumeSignal({
            runId: activeRun.id,
            signalName: step.signal,
          })

        const signal = await consumeSignal()
        const resumeSignal = async (args: {
          run: WorkflowRunRecord
          payload: JsonValue | undefined
          attempt: number
        }) => {
          const signalExecutionContext = createExecutionContext({
            run: args.run,
            attempt: args.attempt,
            stepKey,
            heartbeat: async () => false,
            db: stepBindings.db,
            outbox: stepBindings.outbox,
            transactional: false,
          })
          const result: WaitStepResumeResult = await step.resume(
            signalExecutionContext,
            args.payload
          )
          const nextStepKey = result.transition ?? step.next

          if (!nextStepKey) {
            throw new Error(
              `Signal step "${stepKey}" in workflow "${definition.name}" did not resolve a next step`
            )
          }

          return {
            nextStepKey,
            context: mergeContext(args.run.context, result.patch),
            output: result.output ?? null,
          }
        }

        if (!signal) {
          activeRun = await args.store.openWait({
            runId: activeRun.id,
            stepKey,
            workerId: args.workerId,
            attemptId: attempt.id,
            context: activeRun.context,
            correlationKey: `signal:${activeRun.id}:${step.signal}`,
            payload: {
              signalName: step.signal,
            },
            expiresAt: getStepExpiresAt(step.timeoutMs, executionContext.now),
            output: null,
          })

          const resumed = await args.store.consumeSignalAndResumeWait({
            correlationKey: `signal:${activeRun.id}:${step.signal}`,
            signalName: step.signal,
            resume: async (signalPayload) =>
              resumeSignal({
                run: activeRun,
                payload: signalPayload,
                attempt: 0,
              }),
          })

          args.metrics.waitOpens.set(await args.store.countOpenWaits())

          if (resumed.status === "resumed" && resumed.run) {
            return resumed.run
          }

          return activeRun
        }

        const result = await resumeSignal({
          run: activeRun,
          payload: signal.payload ?? undefined,
          attempt: attempt.attempt,
        })
        activeRun = await args.store.advanceTaskStep({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          nextStepKey: result.nextStepKey,
          context: result.context,
          output: result.output,
        })

        args.metrics.stepAttempts.inc({
          workflow: definition.name,
          step: stepKey,
          status: "completed",
        })
        args.metrics.waitOpens.set(await args.store.countOpenWaits())
        return activeRun
      }

      if (step.kind === "child") {
        const childRun = await args.store.getChildRun({
          parentRunId: activeRun.id,
          parentStepKey: stepKey,
        })

        const resumeChild = async (run: WorkflowRunRecord) => {
          const childExecutionContext = createExecutionContext({
            run: activeRun,
            attempt: attempt.attempt,
            stepKey,
            heartbeat: async () => false,
            db: stepBindings.db,
            outbox: stepBindings.outbox,
            transactional: false,
          })
          const result: ChildStepResult = await step.resume(
            childExecutionContext,
            run
          )
          const nextStepKey = result.transition ?? step.next

          if (!nextStepKey) {
            throw new Error(
              `Child step "${stepKey}" in workflow "${definition.name}" did not resolve a next step`
            )
          }

          return {
            nextStepKey,
            context: mergeContext(activeRun.context, result.patch),
            output: result.output ?? run.result ?? null,
          }
        }

        if (childRun && isTerminalStatus(childRun.status)) {
          const result = await resumeChild(childRun)
          activeRun = await args.store.advanceTaskStep({
            runId: activeRun.id,
            stepKey,
            workerId: args.workerId,
            attemptId: attempt.id,
            nextStepKey: result.nextStepKey,
            context: result.context,
            output: result.output,
          })

          args.metrics.stepAttempts.inc({
            workflow: definition.name,
            step: stepKey,
            status: "completed",
          })
          return activeRun
        }

        if (!childRun) {
          const childInput = await Promise.resolve(step.input(executionContext))
          await args.store.startRun({
            parentRunId: activeRun.id,
            parentStepKey: stepKey,
            definitionName: step.workflow,
            definitionVersion: requireDefinition(args.definitions, step.workflow)
              .version,
            taskQueue: activeRun.taskQueue,
            priority: activeRun.priority,
            input: childInput,
            currentStepKey: requireDefinition(args.definitions, step.workflow)
              .startAt,
          })
        }

        activeRun = await args.store.openWait({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          context: activeRun.context,
          correlationKey: `child:${activeRun.id}:${stepKey}`,
          payload: {
            workflowName: step.workflow,
          },
          expiresAt: null,
          output: null,
        })
        args.metrics.stepAttempts.inc({
          workflow: definition.name,
          step: stepKey,
          status: "completed",
        })
        args.metrics.waitOpens.set(await args.store.countOpenWaits())
        return activeRun
      }

      if (step.kind !== "task") {
        throw new Error("Encountered an unsupported executable step kind")
      }

      if (step.transactional) {
        const outcome = await args.store.executeTransactionalTask({
          run: activeRun,
          stepKey,
          workerId: args.workerId,
          ...(step.next === undefined ? {} : { nextStepKey: step.next }),
          ...(step.retry === undefined ? {} : { retryPolicy: step.retry }),
          ...(step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs }),
          resolveRetryAvailableAt: ({ attempt, retryPolicy }) =>
            getRetryAvailableAt({
              attempt,
              ...createRetryDelayInput(retryPolicy),
            }),
          getErrorTag,
          asErrorPayload,
          mergeContext,
          runTask: step.run,
        })

        if (outcome.outcome === "lost_lease") {
          return null
        }

        activeRun = outcome.run

        if (outcome.outcome === "completed") {
          args.metrics.stepAttempts.inc({
            workflow: definition.name,
            step: stepKey,
            status: "completed",
          })
        } else {
          args.metrics.stepAttempts.inc({
            workflow: definition.name,
            step: stepKey,
            status: "failed",
          })
          if (outcome.outcome === "retry_scheduled") {
            args.metrics.retries.inc({
              workflow: definition.name,
              step: stepKey,
            })
          } else {
            args.metrics.runsFailed.inc({
              workflow: definition.name,
              step: stepKey,
            })
            observeRunDuration({
              metrics: args.metrics,
              run: activeRun,
              status: "failed",
            })
            activeRun = await compensateRun({
              definitions: args.definitions,
              metrics: args.metrics,
              store: args.store,
              run: activeRun,
            })
          }
        }

        return activeRun
      }

      const result = await withTimeout(
        Promise.resolve(step.run(executionContext)),
        step.timeoutMs,
        `Task step "${stepKey}" in workflow "${definition.name}"`
      )

      if (result.continueAsNew) {
        const nextRun = await args.store.continueAsNew({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          context: mergeContext(activeRun.context, result.patch),
          currentStepKey: definition.startAt,
          input: result.continueAsNew.payload,
          taskQueue: result.continueAsNew.taskQueue ?? activeRun.taskQueue,
          priority: result.continueAsNew.priority ?? activeRun.priority,
        })

        args.metrics.runsStarted.inc({ workflow: definition.name })
        observeRunDuration({
          metrics: args.metrics,
          run: activeRun,
          status: "completed",
        })
        args.metrics.stepAttempts.inc({
          workflow: definition.name,
          step: stepKey,
          status: "completed",
        })
        return nextRun
      }

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
      return activeRun
    } catch (error) {
      if (error instanceof LostLeaseError) {
        return null
      }

      const retryPolicy = step.kind === "task" ? step.retry : undefined
      const errorTag = getErrorTag(error)
      const isNonRetryable =
        errorTag !== null &&
        retryPolicy?.nonRetryableErrorTags?.includes(errorTag) === true
      const canRetry =
        retryPolicy !== undefined &&
        !isNonRetryable &&
        attempt.attempt < retryPolicy.maxAttempts

      if (canRetry) {
        activeRun = await args.store.scheduleRetry({
          runId: activeRun.id,
          stepKey,
          workerId: args.workerId,
          attemptId: attempt.id,
          availableAt: getRetryAvailableAt({
            attempt: attempt.attempt,
            ...createRetryDelayInput(retryPolicy),
          }),
          error: asErrorPayload(error),
        })
        args.metrics.retries.inc({
          workflow: definition.name,
          step: stepKey,
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
        observeRunDuration({
          metrics: args.metrics,
          run: activeRun,
          status: "failed",
        })
        activeRun = await compensateRun({
          definitions: args.definitions,
          metrics: args.metrics,
          store: args.store,
          run: activeRun,
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

const compensateRun = async (args: {
  definitions: DefinitionRegistry
  metrics: HippoMetrics
  store: WorkflowStore
  run: WorkflowRunRecord
}) => {
  if (args.run.status !== "failed" && args.run.status !== "canceled") {
    return args.run
  }

  const definition = requireDefinition(
    args.definitions,
    args.run.definitionName,
    args.run.definitionVersion
  )
  const attempts = await args.store.getRunAttempts(args.run.id)
  const compensatedStepKeys = new Set(
    attempts
      .filter(
        (attempt) =>
          attempt.kind === "compensate" && attempt.status === "completed"
      )
      .map((attempt) => attempt.stepKey)
  )
  const compensatableSteps = [...attempts]
    .reverse()
    .flatMap((attempt) => {
      if (
        attempt.kind !== "forward" ||
        attempt.status !== "completed" ||
        compensatedStepKeys.has(attempt.stepKey)
      ) {
        return []
      }

      const step = definition.steps[attempt.stepKey]

      if (!step || step.kind !== "task") {
        return []
      }

      const compensation = getCompensationDefinition(step)

      if (!compensation) {
        return []
      }

      compensatedStepKeys.add(attempt.stepKey)

      return [
        {
          stepKey: attempt.stepKey,
          compensation,
        },
      ]
    })
  let activeRun = args.run

  for (const item of compensatableSteps) {
    const cause =
      activeRun.error ??
      ({
        status: activeRun.status,
        ...(activeRun.cancelMode === null ? {} : { mode: activeRun.cancelMode }),
      } satisfies JsonObject)

    for (;;) {
      const compensationAttempt = await args.store.beginStepAttempt({
        runId: activeRun.id,
        stepKey: item.stepKey,
        kind: "compensate",
        input: {
          workflow: activeRun.definitionName,
          step: item.stepKey,
          mode: "compensate",
          context: activeRun.context,
          cause,
        },
      })

      try {
        await Promise.resolve(
          item.compensation.run(
            createExecutionContext({
              run: activeRun,
              attempt: compensationAttempt.attempt,
              stepKey: item.stepKey,
              heartbeat: async () => false,
              db: {
                query: args.store.queryStepDatabase,
              },
              outbox: {
                enqueue: async (input) => {
                  await args.store.enqueueOutbox({
                    runId: activeRun.id,
                    topic: input.topic,
                    payload: input.payload,
                    ...(input.availableAt === undefined
                      ? {}
                      : { availableAt: input.availableAt }),
                  })
                },
              },
              transactional: false,
            }),
            cause
          )
        )
        await args.store.completeStepAttempt({
          runId: activeRun.id,
          stepKey: item.stepKey,
          attemptId: compensationAttempt.id,
          output: {
            status: "compensated",
          },
        })
        break
      } catch (error) {
        await args.store.failStepAttempt({
          runId: activeRun.id,
          stepKey: item.stepKey,
          attemptId: compensationAttempt.id,
          error: asErrorPayload(error),
        })

        const retryPolicy =
          item.compensation.retry ?? defaultCompensationRetryPolicy
        const canRetry = compensationAttempt.attempt < retryPolicy.maxAttempts

        if (!canRetry) {
          activeRun = await args.store.markRunCompensationFailed({
            runId: activeRun.id,
            stepKey: item.stepKey,
            error: asErrorPayload(error),
          })
          return activeRun
        }

        const retryAvailableAt = getRetryAvailableAt({
          attempt: compensationAttempt.attempt,
          ...createRetryDelayInput(retryPolicy),
        })

        await sleep(Math.max(0, retryAvailableAt.getTime() - Date.now()))
      }
    }
  }

  return (await args.store.getRun(activeRun.id)) ?? activeRun
}

export const createWorkflowEngine = (args: {
  definitions: WorkflowDefinition[]
  metrics: HippoMetrics
  store: WorkflowStore
}) => {
  const definitions = createDefinitionRegistry(args.definitions)

  const startRun = async (input: {
    workflowName: string
    payload: JsonObject
    idempotencyKey?: string
    taskQueue?: string
    priority?: number
  }) => {
    const definition = requireDefinition(definitions, input.workflowName)

    const run = await args.store.startRun({
      definitionName: definition.name,
      definitionVersion: definition.version,
      taskQueue: input.taskQueue ?? "default",
      priority: input.priority ?? 0,
      input: input.payload,
      currentStepKey: definition.startAt,
      ...(input.idempotencyKey === undefined
        ? {}
        : { idempotencyKey: input.idempotencyKey }),
    })

    args.metrics.runsStarted.inc({ workflow: definition.name })
    return run
  }

  const tick = async (
    workerId: string,
    leaseMs: number,
    taskQueues = ["default"]
  ) => {
    const claimedRun = await args.store.claimNextRunnableRun({
      workerId,
      leaseMs,
      taskQueues,
    })

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

  const runCompensation = async (runId: string) => {
    const run = await args.store.getRun(runId)

    if (!run) {
      return null
    }

    return compensateRun({
      definitions,
      metrics: args.metrics,
      store: args.store,
      run,
    })
  }

  const resumeWait = async (input: {
    correlationKey: string
    payload?: JsonValue
  }) =>
    {
      const resumed = await args.store.resumeWait({
        correlationKey: input.correlationKey,
        payload: input.payload,
        resume: async (run, wait) => {
          const definition = requireDefinition(
            definitions,
            run.definitionName,
            run.definitionVersion
          )
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
              heartbeat: async () => false,
              db: {
                query: args.store.queryStepDatabase,
              },
              outbox: {
                enqueue: async (outboxInput) => {
                  await args.store.enqueueOutbox({
                    runId: run.id,
                    topic: outboxInput.topic,
                    payload: outboxInput.payload,
                    ...(outboxInput.availableAt === undefined
                      ? {}
                      : { availableAt: outboxInput.availableAt }),
                  })
                },
              },
              transactional: false,
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

      args.metrics.waitOpens.set(await args.store.countOpenWaits())
      return resumed
    }

  return {
    getWorkflow: (workflowName: string, version?: number) =>
      requireDefinition(definitions, workflowName, version),
    hasWorkflow: (workflowName: string, version?: number) =>
      getDefinition(definitions, workflowName, version) !== null,
    listWorkflows: () => [...definitions.latestByName.values()],
    resumeWait,
    runCompensation,
    startRun,
    tick,
  }
}

export type WorkflowEngine = ReturnType<typeof createWorkflowEngine>
