import { describe, expect, it, vi } from "vitest"
import {
  defineWorkflow,
  endStep,
  waitStep,
  externalSession,
  sleepStep,
  signalStep,
  humanTask,
} from "./workflow-definition.js"
import { isHumanTaskWaitPayload, verifyHumanTaskToken } from "./engine/human-task.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import type { JsonObject, JsonValue } from "../types/json.js"
import {
  drainEngine,
  getGaugeValue,
  createStoreStub,
} from "./workflow-engine.test-helpers.js"

describe("workflow engine waits and signals", () => {
  it("resumes a wait exactly once in the store contract", async () => {
    const workflow = defineWorkflow({
      name: "wait-workflow",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: () => ({ correlationKey: "abc123" }),
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
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

    await engine.startRun({
      workflowName: "wait-workflow",
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    const first = await engine.resumeWait({
      correlationKey: "abc123",
      payload: { status: "ok" },
    })
    const second = await engine.resumeWait({
      correlationKey: "abc123",
      payload: { status: "ok" },
    })

    expect(first.status).toBe("resumed")
    expect(first.run?.currentStepKey).toBe("done")
    expect(second.status).toBe("duplicate")
    expect(second.run?.id).toBe(first.run?.id)
  })

  it("opens and resumes an external session step by external id", async () => {
    const workflow = defineWorkflow({
      name: "external-workflow",
      version: 1,
      startAt: "transcode",
      steps: {
        transcode: externalSession({
          sessionKind: "video-transcode",
          next: "done",
          timeoutMs: 60_000,
          start: () => ({
            externalId: "transcode-123",
            payload: { status: "started" },
          }),
          resume: (_context, externalId, payload) => ({
            patch: { externalId, callback: payload ?? null },
            output: { status: "complete" },
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
      workflowName: "external-workflow",
      payload: {},
    })
    const waiting = await engine.tick("test-worker", 5_000)

    expect(waiting?.status).toBe("waiting")

    const [attempt] = await store.getRunAttempts(run.id)
    expect(attempt?.output).toEqual({ status: "started" })

    const first = await engine.resumeExternalSession({
      externalSessionId: "transcode-123",
      payload: { resultUrl: "s3://bucket/out.mp4" },
    })
    const second = await engine.resumeExternalSession({
      externalSessionId: "transcode-123",
      payload: { resultUrl: "s3://bucket/out.mp4" },
    })

    expect(first.status).toBe("resumed")
    expect(first.run?.currentStepKey).toBe("done")
    expect(first.run?.context).toMatchObject({
      externalId: "transcode-123",
      callback: { resultUrl: "s3://bucket/out.mp4" },
    })
    expect(second.status).toBe("duplicate")
    expect(second.run?.id).toBe(first.run?.id)
  })

  it("cancels open external sessions before hard cancellation", async () => {
    const canceledExternalIds: string[] = []
    const workflow = defineWorkflow({
      name: "external-cancel-workflow",
      version: 1,
      startAt: "transcode",
      steps: {
        transcode: externalSession({
          sessionKind: "video-transcode",
          next: "done",
          timeoutMs: 60_000,
          start: () => ({
            externalId: "transcode-cancel-123",
          }),
          cancel: (_context, externalId) => {
            canceledExternalIds.push(externalId)
          },
          resume: () => ({
            patch: {},
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
      workflowName: workflow.name,
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    const result = await engine.cancelExternalSessionsForRun(run.id)

    expect(result.attempted).toBe(1)
    expect(canceledExternalIds).toEqual(["transcode-cancel-123"])
  })

  it("supports sleep scheduling", async () => {
    const workflow = defineWorkflow({
      name: "sleep-workflow",
      version: 1,
      startAt: "pause",
      steps: {
        pause: sleepStep({
          kind: "sleep",
          next: "done",
          until: 50,
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
      workflowName: "sleep-workflow",
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    const scheduled = await store.getRun(run.id)

    expect(scheduled?.status).toBe("queued")
    expect(scheduled?.currentStepKey).toBe("done")
    expect((scheduled?.availableAt.getTime() ?? 0) > Date.now()).toBe(true)
  })

  it("updates the open wait gauge after a wait resumes", async () => {
    const workflow = defineWorkflow({
      name: "wait-metrics",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 60_000,
          open: () => ({ correlationKey: "wait-metrics-key" }),
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
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

    await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    await engine.tick("test-worker", 5_000)

    expect(await getGaugeValue("hippo_waits_open", metrics)).toBe(1)

    const resumed = await engine.resumeWait({
      correlationKey: "wait-metrics-key",
      payload: { ok: true },
    })

    expect(resumed.status).toBe("resumed")
    expect(await getGaugeValue("hippo_waits_open", metrics)).toBe(0)
  })

  it("buffers and consumes a signal step", async () => {
    const workflow = defineWorkflow({
      name: "signal-workflow",
      version: 1,
      startAt: "gate",
      steps: {
        gate: signalStep({
          kind: "signal",
          signal: "approved",
          next: "done",
          timeoutMs: 60_000,
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
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
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    expect((await store.getRun(run.id))?.status).toBe("waiting")

    await store.createSignal({
      runId: run.id,
      signalName: "approved",
      payload: { ok: true },
    })
    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)

    const completed = await store.getRun(run.id)
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ payload: { ok: true } })
  })

  it("consumes a signal that arrives during the running-to-waiting race window", async () => {
    let sendSignal: (() => Promise<void>) | undefined
    const workflow = defineWorkflow({
      name: "signal-race-workflow",
      version: 1,
      startAt: "gate",
      steps: {
        gate: signalStep({
          kind: "signal",
          signal: "approved",
          next: "done",
          timeoutMs: 60_000,
          resume: (_context, payload) => ({
            patch: { payload: payload ?? null },
          }),
        }),
        done: endStep(),
      },
    })
    const baseStore = createStoreStub()
    const store = {
      ...baseStore,
      async openWait(args: {
        runId: string
        stepKey: string
        correlationKey: string
        payload: JsonValue | null
        expiresAt: Date | null
        output: JsonValue | null
        attemptId: string
        context: JsonObject
      }) {
        if (sendSignal) {
          await sendSignal()
          sendSignal = undefined
        }

        return baseStore.openWait(args)
      },
    }
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    sendSignal = () =>
      store.createSignal({
        runId: run.id,
        signalName: "approved",
        payload: { ok: "race" },
      }).then(() => undefined)

    await engine.tick("test-worker", 5_000)
    await engine.tick("test-worker", 5_000)

    const completed = await store.getRun(run.id)
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toEqual({ payload: { ok: "race" } })
  })

  it("expires timed out waits during recovery", async () => {
    const workflow = defineWorkflow({
      name: "expiring-wait",
      version: 1,
      startAt: "hold",
      steps: {
        hold: waitStep({
          kind: "wait",
          next: "done",
          timeoutMs: 1,
          open: () => ({ correlationKey: "expiring-key" }),
          resume: () => ({
            patch: {},
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
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBe(1)

    const failed = await store.getRun(run.id)
    expect(failed?.status).toBe("failed")
  })

  it("opens and resumes a human task with an approval payload", async () => {
    const workflow = defineWorkflow({
      name: "human-task-approve",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "done",
          transitions: {
            timeout: "timed-out",
          },
          timeoutMs: 60_000,
          open: ({ approvalUrl }) => ({
            prompt: {
              approvalUrl,
            },
          }),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
              data: decision.data ?? null,
            },
          }),
          timeout: {
            transition: "timed-out",
          },
        }),
        "timed-out": endStep(),
        done: endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)

    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })
    expect(isHumanTaskWaitPayload(wait?.payload)).toBe(true)
    if (!wait || !isHumanTaskWaitPayload(wait.payload)) {
      throw new Error("expected human task wait payload")
    }

    const token = wait.payload.approvalUrl.split("/").at(-1)
    expect(token).toBeTruthy()

    const claims = verifyHumanTaskToken({
      token: token!,
      secret: "human-secret",
      toleranceSeconds: 300,
    })

    expect(claims?.correlationKey).toBe(wait.correlationKey)

    const resumed = await engine.resumeHumanTask({
      correlationKey: wait.correlationKey,
      decision: {
        decision: "approve",
        data: {
          reviewer: "alice",
        },
      },
    })
    await drainEngine(engine)

    const completed = await store.getRun(run.id)

    expect(resumed.status).toBe("resumed")
    expect(completed?.status).toBe("completed")
    expect(completed?.context).toMatchObject({
      decision: "approve",
      data: {
        reviewer: "alice",
      },
    })
  })

  it("routes rejected human tasks through their transition", async () => {
    const workflow = defineWorkflow({
      name: "human-task-reject",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "approved",
          timeoutMs: 60_000,
          open: () => ({}),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
            },
            transition: decision.decision === "reject" ? "rejected" : "approved",
          }),
          timeout: {
            transition: "timed-out",
          },
          transitions: {
            timeout: "timed-out",
          },
        }),
        approved: endStep(),
        rejected: endStep(),
        "timed-out": endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)

    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })
    if (!wait) {
      throw new Error("expected review wait")
    }

    await engine.resumeHumanTask({
      correlationKey: wait.correlationKey,
      decision: {
        decision: "reject",
      },
    })
    await drainEngine(engine)

    const completed = await store.getRun(run.id)
    const resumedWaits = await store.listStepWaits({ runId: run.id, stepKey: "review" })

    expect(completed?.status).toBe("completed")
    expect(completed?.context.decision).toBe("reject")
    expect(resumedWaits[0]?.resumePayload).toEqual({
      decision: "reject",
    })
  })

  it("routes timed-out human tasks through their timeout transition", async () => {
    const workflow = defineWorkflow({
      name: "human-task-timeout",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "approved",
          timeoutMs: 1,
          open: () => ({}),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
            },
          }),
          timeout: {
            transition: "timed-out",
            patch: {
              timedOut: true,
            },
          },
          transitions: {
            timeout: "timed-out",
          },
        }),
        approved: endStep(),
        "timed-out": endStep(),
      },
    })
    const store = createStoreStub()
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("test-worker", 5_000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBe(1)
    await drainEngine(engine)

    const completed = await store.getRun(run.id)

    expect(completed?.status).toBe("completed")
    expect(completed?.currentStepKey).toBeNull()
    expect(completed?.context.timedOut).toBe(true)
  })
})
