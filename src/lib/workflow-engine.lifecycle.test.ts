import { describe, expect, it } from "vitest"
import {
  defineWorkflow,
  endStep,
  taskStep,
  childStep,
  waitStep,
} from "./workflow-definition.js"
import { createMetrics } from "./metrics.js"
import { createHippoTracer } from "./tracing.js"
import { createRecordingTracer } from "./tracing.test-helpers.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  getGaugeValue,
  requireNumber,
  createStoreStub,
} from "./workflow-engine.test-helpers.js"

describe("workflow engine lifecycle", () => {
  it("runs a task workflow to completion", async () => {
    const workflow = defineWorkflow({
      name: "test-workflow",
      version: 1,
      startAt: "start",
      steps: {
        start: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: { delivered: true },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "test-workflow",
      payload: { hello: "world" },
    })

    await engine.tick("test-worker", 5_000)
    const queued = await store.getRun(run.id)

    expect(queued?.status).toBe("queued")
    expect(queued?.currentStepKey).toBe("done")
    expect(queued?.context).toEqual({ delivered: true })

    await engine.tick("test-worker", 5_000)
    const completed = await store.getRun(run.id)

    expect(completed?.status).toBe("completed")
  })

  it("emits nested spans while claiming and executing a step", async () => {
    const workflow = defineWorkflow({
      name: "traced-workflow",
      version: 1,
      startAt: "work",
      steps: {
        work: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            patch: {
              ok: true,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const recording = createRecordingTracer()
    const tracer = createHippoTracer({
      tracer: recording.tracer,
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
      tracer,
    })

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    recording.spans.length = 0

    await engine.tick("test-worker", 5_000)

    const tickSpan = recording.spans.find((span) => span.name === "hippo.workflow.tick")
    const stepSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )
    const taskSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.task.run"
    )

    expect(tickSpan).toBeDefined()
    expect(stepSpan?.parentName).toBe("hippo.workflow.tick")
    expect(taskSpan?.parentName).toBe("hippo.workflow.step.execute")
  })

  it("adds attempt and retry metadata to retried task spans", async () => {
    let attempts = 0
    const workflow = defineWorkflow({
      name: "traced-retry-workflow",
      version: 1,
      startAt: "unstable",
      steps: {
        unstable: taskStep({
          kind: "task",
          next: "done",
          retry: {
            maxAttempts: 2,
            initialBackoffMs: 0,
          },
          run: () => {
            attempts += 1

            if (attempts === 1) {
              throw new Error("boom")
            }

            return {
              patch: { ok: true },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const recording = createRecordingTracer()
    const tracer = createHippoTracer({
      tracer: recording.tracer,
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
      tracer,
    })

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
      taskQueue: "priority",
      priority: 7,
    })

    await engine.tick("test-worker", 5_000)
    recording.spans.length = 0
    await engine.tick("test-worker", 5_000)

    const stepSpan = recording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )

    expect(stepSpan?.attributes["workflow.attempt.number"]).toBe(2)
    expect(stepSpan?.attributes["workflow.retry.count"]).toBe(1)
    expect(stepSpan?.attributes["workflow.task_queue"]).toBe("priority")
    expect(stepSpan?.attributes["workflow.priority"]).toBe(7)
  })

  it("adds wait correlation keys and child run ids to step spans", async () => {
    const childWorkflow = defineWorkflow({
      name: "trace-child",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const parentWorkflow = defineWorkflow({
      name: "trace-parent",
      version: 1,
      startAt: "child",
      steps: {
        child: childStep({
          kind: "child",
          workflow: childWorkflow.name,
          next: "done",
          input: () => ({ ok: true }),
          resume: (_context, childRun) => ({
            output: childRun.result,
          }),
        }),
        done: endStep(),
      },
    })
    const waitWorkflow = defineWorkflow({
      name: "trace-wait",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: (context) => ({
            correlationKey: `wait:${context.run.id}:approval`,
          }),
          resume: () => ({}),
        }),
        done: endStep(),
      },
    })
    const childStore = createStoreStub()
    const childRecording = createRecordingTracer()
    const childTracer = createHippoTracer({
      tracer: childRecording.tracer,
    })
    const childEngine = createWorkflowEngine({
      definitions: [parentWorkflow, childWorkflow, waitWorkflow],
      metrics: createMetrics(),
      store: childStore,
      tracer: childTracer,
    })

    const parentRun = await childEngine.startRun({
      workflowName: parentWorkflow.name,
      payload: {},
    })
    childRecording.spans.length = 0
    await childEngine.tick("test-worker", 5_000)

    const childStartSpan = childRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.child.start"
    )
    const childStepSpan = childRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.execute"
    )

    expect(childStartSpan?.attributes["workflow.child.run_id"]).toBeDefined()
    expect(childStepSpan?.attributes["workflow.child.run_id"]).toBeDefined()
    expect(childStepSpan?.attributes["workflow.wait.correlation_key"]).toBe(
      `child:${parentRun.id}:child`
    )

    const waitStore = createStoreStub()
    const waitRecording = createRecordingTracer()
    const waitTracer = createHippoTracer({
      tracer: waitRecording.tracer,
    })
    const waitEngine = createWorkflowEngine({
      definitions: [waitWorkflow],
      metrics: createMetrics(),
      store: waitStore,
      tracer: waitTracer,
    })

    const waitRun = await waitEngine.startRun({
      workflowName: waitWorkflow.name,
      payload: {},
    })
    waitRecording.spans.length = 0
    await waitEngine.tick("test-worker", 5_000)

    const waitOpenSpan = waitRecording.spans.find(
      (span) => span.name === "hippo.workflow.step.wait.open"
    )

    expect(waitOpenSpan?.attributes["workflow.wait.correlation_key"]).toBe(
      `wait:${waitRun.id}:approval`
    )
  })

  it("continues a run as new from a task step", async () => {
    const workflow = defineWorkflow({
      name: "continue-as-new-workflow",
      version: 1,
      startAt: "start",
      steps: {
        start: taskStep({
          kind: "task",
          next: "done",
          run: () => ({
            continueAsNew: {
              payload: { cursor: 2 },
              taskQueue: "bulk",
              priority: 9,
            },
          }),
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const originalRun = await engine.startRun({
      workflowName: workflow.name,
      payload: { cursor: 1 },
      taskQueue: "default",
      priority: 1,
    })
    const continuedRun = await engine.tick("test-worker", 5_000, [
      "default",
      "bulk",
    ])

    expect(continuedRun?.continuedFromRunId).toBe(originalRun.id)
    expect(continuedRun?.taskQueue).toBe("bulk")
    expect(continuedRun?.priority).toBe(9)
    expect(continuedRun?.input).toEqual({ cursor: 2 })

    const completedOriginal = await store.getRun(originalRun.id)
    expect(completedOriginal?.status).toBe("completed")
    expect(completedOriginal?.result).toEqual({
      continuedRunId: continuedRun?.id,
    })
  })

  it("drains a bulk workload without leaking run state", async () => {
    const workflow = defineWorkflow({
      name: "bulk-workflow",
      version: 1,
      startAt: "annotate",
      steps: {
        annotate: taskStep({
          kind: "task",
          next: "done",
          run: ({ input }) => {
            const runIndex = requireNumber(input.runIndex, "runIndex")

            return {
              patch: {
                runIndex,
                checksum: `run-${String(runIndex)}`,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const metrics = createMetrics()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics,
      store,
    })

    const runs = await Promise.all(
      Array.from({ length: 250 }, (_, runIndex) =>
        engine.startRun({
          workflowName: workflow.name,
          payload: { runIndex },
        })
      )
    )

    await drainEngine(engine)

    const completedRuns = await Promise.all(
      runs.map((run) => store.getRun(run.id))
    )

    expect(completedRuns).toHaveLength(250)

    for (const [runIndex, run] of completedRuns.entries()) {
      expect(run?.status).toBe("completed")
      expect(run?.context).toEqual({
        runIndex,
        checksum: `run-${String(runIndex)}`,
      })
      expect(run?.result).toEqual({
        runIndex,
        checksum: `run-${String(runIndex)}`,
      })
    }
  })

  it("persists step body emitted events", async () => {
    const workflow = defineWorkflow({
      name: "step-event-workflow",
      version: 1,
      startAt: "build",
      steps: {
        build: taskStep({
          kind: "task",
          next: "done",
          run: async ({ emit }) => {
            await emit({
              type: "progress",
              data: {
                pct: 0.5,
              },
            })

            return {
              patch: {
                emitted: true,
              },
            }
          },
        }),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await drainEngine(engine)

    const events = await store.getRunEvents(run.id)
    const emitted = events.find(
      (event) => event.eventType === "step.emit:progress"
    )

    expect(emitted).toMatchObject({
      runId: run.id,
      stepKey: "build",
      payload: {
        type: "progress",
        data: {
          pct: 0.5,
        },
        stepKey: "build",
        stepAttemptId: "attempt-1",
      },
    })
  })

  it("replaces workflow definitions while preserving pinned versions", async () => {
    const workflowV1 = defineWorkflow({
      name: "hot-reloadable",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Version one",
        }),
      },
    })
    const workflowV2 = defineWorkflow({
      name: "hot-reloadable",
      version: 2,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Version two",
        }),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflowV1],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([workflowV2])

    expect(engine.getWorkflow("hot-reloadable").version).toBe(2)
    expect(engine.getWorkflow("hot-reloadable", 1).version).toBe(1)
    expect(
      engine.listWorkflowVersions().map((workflow) => workflow.version)
    ).toEqual([1, 2])
  })

  it("does not overwrite an already-registered version during hot reload", async () => {
    const original = defineWorkflow({
      name: "same-version",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Original",
        }),
      },
    })
    const edited = defineWorkflow({
      name: "same-version",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Edited",
        }),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [original],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([edited])

    expect(engine.getWorkflow("same-version", 1).steps.done).toMatchObject({
      label: "Original",
    })
    expect(engine.getWorkflow("same-version").steps.done).toMatchObject({
      label: "Original",
    })
  })

  it("removes deleted workflows from the latest registration set", async () => {
    const keep = defineWorkflow({
      name: "keep",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const remove = defineWorkflow({
      name: "remove",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [keep, remove],
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    engine.replaceDefinitions([keep])

    expect(engine.listWorkflows().map((workflow) => workflow.name)).toEqual([
      "keep",
    ])
    expect(engine.hasWorkflow("remove")).toBe(false)
    expect(engine.getWorkflow("remove", 1).name).toBe("remove")
  })

  it("stores, retrieves, and deletes values in the run-scoped KV store", async () => {
    const values: unknown[] = []
    const workflow = defineWorkflow({
      name: "kv-test",
      version: 1,
      startAt: "set-step",
      steps: {
        "set-step": taskStep({
          kind: "task",
          next: "get-step",
          run: async (ctx) => {
            await ctx.kv.set("my-key", "hello-world")
            await ctx.run.kv.set("my-compat-key", 42)
            return {
              patch: { setDone: true }
            }
          }
        }),
        "get-step": taskStep({
          kind: "task",
          next: "delete-step",
          run: async (ctx) => {
            const val1 = await ctx.kv.get("my-key")
            const val2 = await ctx.run.kv.get("my-compat-key")
            values.push(val1, val2)
            return {
              patch: { getDone: true }
            }
          }
        }),
        "delete-step": taskStep({
          kind: "task",
          next: "done",
          run: async (ctx) => {
            await ctx.kv.delete("my-key")
            const val1 = await ctx.kv.get("my-key")
            values.push(val1)
            return {
              patch: { deleteDone: true }
            }
          }
        }),
        done: endStep()
      }
    })

    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: "kv-test",
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)

    const completedRun = await store.getRun(run.id)
    expect(completedRun?.status).toBe("completed")
    expect(values).toEqual(["hello-world", 42, null])
  })
})
