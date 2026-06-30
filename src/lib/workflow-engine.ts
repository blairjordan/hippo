import type { JsonObject, JsonValue } from "../types/json.js"
import type {
  HumanTaskDecision,
  WorkflowDefinition,
  WaitStepResumeResult,
} from "../types/workflow.js"
import type { HippoMetrics } from "./metrics.js"
import {
  createHippoTracer,
  createTraceAttributes,
  withTraceContext,
  type HippoTracer,
} from "./tracing.js"
import type { WorkflowStore } from "./workflow-store.js"
import {
  createDefinitionRegistry,
  getDefinition,
  listDefinitions,
  replaceDefinitionRegistry,
  requireDefinition,
  getStep,
} from "./engine/registry.js"
import {
  continueRun,
  compensateRun,
  createExecutionContext,
  noopEmit,
  mergeContext,
} from "./engine/run-loop.js"

export const createWorkflowEngine = (args: {
  definitions: WorkflowDefinition[]
  humanTasks?: {
    baseUrl: string
    secret?: string
    toleranceSeconds: number
  }
  metrics: HippoMetrics
  store: WorkflowStore
  tracer?: HippoTracer
}) => {
  let definitions = createDefinitionRegistry(args.definitions)
  const tracer = args.tracer ?? createHippoTracer()

  const startRun = async (input: {
    workflowName: string
    payload: JsonObject
    idempotencyKey?: string
    taskQueue?: string
    priority?: number
  }) => {
    return tracer.withSpan(
      {
        name: "hippo.workflow.start_run",
        attributes: createTraceAttributes({
          operation: "workflow.start_run",
          workflowName: input.workflowName,
          taskQueue: input.taskQueue ?? "default",
        }),
      },
      async () => {
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
    )
  }

  const tick = async (
    workerId: string,
    leaseMs: number,
    taskQueues = ["default"]
  ) => {
    return tracer.withSpan(
      {
        name: "hippo.workflow.tick",
        attributes: {
          ...createTraceAttributes({
            operation: "workflow.tick",
            workerId,
          }),
          "workflow.task_queue_count": taskQueues.length,
        },
      },
      async () => {
        const claimedRun = await args.store.claimNextRunnableRun({
          workerId,
          leaseMs,
          taskQueues,
        })

        if (!claimedRun) {
          return null
        }

        args.metrics.claims.inc()
        return withTraceContext(claimedRun.traceContext, () =>
          continueRun({
            definitions,
            ...(args.humanTasks === undefined
              ? {}
              : { humanTasks: args.humanTasks }),
            metrics: args.metrics,
            store: args.store,
            tracer,
            workerId,
            run: claimedRun,
          })
        )
      }
    )
  }

  const runCompensation = async (runId: string) => {
    const run = await args.store.getRun(runId)

    if (!run) {
      return null
    }

    return withTraceContext(run.traceContext, () =>
      tracer.withSpan(
        {
          name: "hippo.workflow.run_compensation",
          attributes: createTraceAttributes({
            operation: "workflow.run_compensation",
            workflowName: run.definitionName,
            workflowVersion: run.definitionVersion,
            runId: run.id,
            taskQueue: run.taskQueue,
          }),
        },
        () =>
          compensateRun({
            definitions,
            metrics: args.metrics,
            store: args.store,
            tracer,
            run,
          })
      )
    )
  }

  const resumeWait = async (input: {
    correlationKey: string
    payload?: JsonValue
  }) => {
    return tracer.withSpan(
      {
        name: "hippo.workflow.resume_wait",
        attributes: {
          "hippo.operation": "workflow.resume_wait",
          "workflow.wait.correlation_key": input.correlationKey,
        },
      },
      async () => {
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

            const kv = {
              get: async (key: string) => args.store.getRunKV(run.id, key),
              set: async (key: string, value: JsonValue) => args.store.setRunKV(run.id, key, value),
              delete: async (key: string) => args.store.deleteRunKV(run.id, key),
            }

            const resumeContext = createExecutionContext({
              run: {
                ...run,
                kv,
              },
              attempt: 0,
              stepKey: wait.stepKey,
              heartbeat: async () => false,
              emit: noopEmit,
              recordUsage: async (usage) => {
                await args.store.recordUsage({
                  runId: run.id,
                  stepKey: wait.stepKey,
                  stepAttemptId: null,
                  usage,
                  ...(definition.budget === undefined
                    ? {}
                    : { budget: definition.budget }),
                })
              },
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
              kv,
            })
            const result: WaitStepResumeResult = await step.resume(
              resumeContext,
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
    )
  }

  const resumeHumanTask = async (input: {
    correlationKey: string
    decision: HumanTaskDecision
  }) => {
    return tracer.withSpan(
      {
        name: "hippo.workflow.resume_human_task",
        attributes: {
          "hippo.operation": "workflow.resume_human_task",
          "workflow.wait.correlation_key": input.correlationKey,
        },
      },
      async () => {
        const resumed = await args.store.resumeWait({
          correlationKey: input.correlationKey,
          payload: input.decision,
          resume: async (run, wait) => {
            const definition = requireDefinition(
              definitions,
              run.definitionName,
              run.definitionVersion
            )
            const step = getStep(definition, wait.stepKey)

            if (step.kind !== "humanTask") {
              throw new Error(
                `Step "${wait.stepKey}" in workflow "${definition.name}" is not a human task`
              )
            }

            const kv = {
              get: async (key: string) => args.store.getRunKV(run.id, key),
              set: async (key: string, value: JsonValue) => args.store.setRunKV(run.id, key, value),
              delete: async (key: string) => args.store.deleteRunKV(run.id, key),
            }

            const result = await step.resume(
              createExecutionContext({
                run: {
                  ...run,
                  kv,
                },
                attempt: 0,
                stepKey: wait.stepKey,
                heartbeat: async () => false,
                emit: noopEmit,
                recordUsage: async (usage) => {
                  await args.store.recordUsage({
                    runId: run.id,
                    stepKey: wait.stepKey,
                    stepAttemptId: null,
                    usage,
                    ...(definition.budget === undefined
                      ? {}
                      : { budget: definition.budget }),
                  })
                },
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
                kv,
              }),
              input.decision
            )
            const nextStepKey = result.transition ?? step.next

            if (!nextStepKey) {
              throw new Error(
                `Human task step "${wait.stepKey}" in workflow "${definition.name}" did not resolve a next step`
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
    )
  }

  const resumeExternalSession = async (input: {
    externalSessionId: string
    payload?: JsonValue
  }) =>
    tracer.withSpan(
      {
        name: "hippo.workflow.resume_external_session",
        attributes: {
          "hippo.operation": "workflow.resume_external_session",
          "workflow.external_session.id": input.externalSessionId,
        },
      },
      async () => {
        const resumed = await args.store.resumeExternalSession({
          externalSessionId: input.externalSessionId,
          payload: input.payload,
          resume: async (run, wait) => {
            const definition = requireDefinition(
              definitions,
              run.definitionName,
              run.definitionVersion
            )
            const step = getStep(definition, wait.stepKey)

            if (step.kind !== "externalSession") {
              throw new Error(
                `Step "${wait.stepKey}" in workflow "${definition.name}" is not an external session`
              )
            }

            if (!wait.externalSessionId) {
              throw new Error(
                `External session step "${wait.stepKey}" in workflow "${definition.name}" has no external id`
              )
            }

            const kv = {
              get: async (key: string) => args.store.getRunKV(run.id, key),
              set: async (key: string, value: JsonValue) => args.store.setRunKV(run.id, key, value),
              delete: async (key: string) => args.store.deleteRunKV(run.id, key),
            }

            const result: WaitStepResumeResult = await step.resume(
              createExecutionContext({
                run: {
                  ...run,
                  kv,
                },
                attempt: 0,
                stepKey: wait.stepKey,
                heartbeat: async () => false,
                emit: noopEmit,
                recordUsage: async (usage) => {
                  await args.store.recordUsage({
                    runId: run.id,
                    stepKey: wait.stepKey,
                    stepAttemptId: null,
                    usage,
                    ...(definition.budget === undefined
                      ? {}
                      : { budget: definition.budget }),
                  })
                },
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
                kv,
              }),
              wait.externalSessionId,
              input.payload
            )
            const nextStepKey = result.transition ?? step.next

            if (!nextStepKey) {
              throw new Error(
                `External session step "${wait.stepKey}" in workflow "${definition.name}" did not resolve a next step`
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
    )

  const cancelExternalSessionsForRun = async (runId: string) => {
    const run = await args.store.getRun(runId)

    if (!run) {
      return { attempted: 0 }
    }

    const waits = await args.store.listOpenExternalSessions(runId)
    const definition = requireDefinition(
      definitions,
      run.definitionName,
      run.definitionVersion
    )
    let attempted = 0

    for (const wait of waits) {
      if (!wait.externalSessionId) {
        continue
      }

      const step = getStep(definition, wait.stepKey)

      if (step.kind !== "externalSession" || !step.cancel) {
        continue
      }

      attempted += 1

      try {
        await args.store.recordUsage({
          runId: run.id,
          stepKey: wait.stepKey,
          stepAttemptId: null,
          usage: {
            resource: "externalSession.cancel",
            amount: 1,
            dimension: "calls",
          },
          ...(definition.budget === undefined
            ? {}
            : { budget: definition.budget }),
        })

        const kv = {
          get: async (key: string) => args.store.getRunKV(run.id, key),
          set: async (key: string, value: JsonValue) => args.store.setRunKV(run.id, key, value),
          delete: async (key: string) => args.store.deleteRunKV(run.id, key),
        }

        await step.cancel(
          createExecutionContext({
            run: {
              ...run,
              kv,
            },
            attempt: 0,
            stepKey: wait.stepKey,
            heartbeat: async () => false,
            emit: noopEmit,
            recordUsage: async (usage) => {
              await args.store.recordUsage({
                runId: run.id,
                stepKey: wait.stepKey,
                stepAttemptId: null,
                usage,
                ...(definition.budget === undefined
                  ? {}
                  : { budget: definition.budget }),
              })
            },
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
            kv,
          }),
          wait.externalSessionId
        )
      } catch {
        continue
      }
    }

    return { attempted }
  }

  return {
    cancelExternalSessionsForRun,
    getWorkflow: (workflowName: string, version?: number) =>
      requireDefinition(definitions, workflowName, version),
    hasWorkflow: (workflowName: string, version?: number) =>
      getDefinition(definitions, workflowName, version) !== null,
    listWorkflows: () => [...definitions.latestByName.values()],
    listWorkflowVersions: () => listDefinitions(definitions),
    replaceDefinitions: (nextDefinitions: WorkflowDefinition[]) => {
      definitions = replaceDefinitionRegistry(definitions, nextDefinitions)
      return [...definitions.latestByName.values()]
    },
    resumeExternalSession,
    resumeHumanTask,
    resumeWait,
    runCompensation,
    startRun,
    tick,
  }
}

export type WorkflowEngine = ReturnType<typeof createWorkflowEngine>
