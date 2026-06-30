import { describe, expect, it } from "vitest"
import {
  defineWorkflow,
  endStep,
  externalSession,
  humanTask,
} from "./workflow-definition.js"
import { isHumanTaskWaitPayload } from "./engine/human-task.js"
import { createMetrics } from "./metrics.js"
import { createWorkflowEngine } from "./workflow-engine.js"
import {
  drainEngine,
  setupTestDatabase,
  testDatabaseUrl,
} from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - waits", () => {
  const { getPool, getStore } = setupTestDatabase()

  it("deduplicate run creation by workflow and idempotency key", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "idempotent-start",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const first = await engine.startRun({
      workflowName: workflow.name,
      payload: { orderId: "123" },
      idempotencyKey: "start-123",
    })
    const second = await engine.startRun({
      workflowName: workflow.name,
      payload: { orderId: "456" },
      idempotencyKey: "start-123",
    })

    expect(second.id).toBe(first.id)
    expect(second.input).toEqual({ orderId: "123" })

    const events = await store.getRunEvents(first.id)

    expect(
      events.filter((event) => event.eventType === "run.started")
    ).toHaveLength(1)

    await drainEngine(engine)
  })

  it("persists and resumes external session waits by external id", async () => {
    const pool = getPool()
    const store = getStore()
    const workflow = defineWorkflow({
      name: "pg-external-session",
      version: 1,
      startAt: "submit",
      steps: {
        submit: externalSession({
          sessionKind: "video-transcode",
          next: "done",
          timeoutMs: 300_000,
          start: () => ({
            externalId: "pg-transcode-123",
            payload: {
              status: "submitted",
            },
          }),
          resume: (_context, externalId, payload) => ({
            patch: {
              externalId,
              callbackPayload: payload ?? null,
            },
            output: {
              status: "complete",
            },
          }),
        }),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })
    const waitingRun = await engine.tick("pg-test-worker", 15_000)

    expect(waitingRun?.status).toBe("waiting")

    const waitRows = await pool.query<{
      external_session_id: string | null
      external_session_kind: string | null
      payload: { status: string } | null
    }>(
      `
        SELECT external_session_id, external_session_kind, payload
        FROM workflow_waits
        WHERE run_id = $1
      `,
      [run.id]
    )

    expect(waitRows.rows).toHaveLength(1)
    expect(waitRows.rows[0]?.external_session_id).toBe("pg-transcode-123")
    expect(waitRows.rows[0]?.external_session_kind).toBe("video-transcode")
    expect(waitRows.rows[0]?.payload).toEqual({ status: "submitted" })

    const heartbeat = await store.recordExternalHeartbeat({
      externalSessionId: "pg-transcode-123",
      leaseMs: 30_000,
      payload: {
        progress: 0.5,
        message: "encoding",
      },
    })
    const heartbeatRun = await store.getRun(run.id)
    const heartbeatAttempts = await store.getRunAttempts(run.id)
    const heartbeatEvents = await store.getRunEvents(run.id)
    const submitAttempt = heartbeatAttempts.find(
      (attempt) => attempt.stepKey === "submit"
    )

    expect(heartbeat).toMatchObject({
      status: "recorded",
      runId: run.id,
      stepKey: "submit",
    })
    expect(heartbeatRun?.leaseExpiresAt?.getTime()).toBeGreaterThan(Date.now())
    expect(submitAttempt?.externalSessionId).toBe("pg-transcode-123")
    expect(submitAttempt?.externalSessionKind).toBe("video-transcode")
    expect(submitAttempt?.lastHeartbeatAt).toBeInstanceOf(Date)
    expect(
      heartbeatEvents.some(
        (event) =>
          event.eventType === "step.external_heartbeat" &&
          event.payload.progress === 0.5 &&
          event.payload.message === "encoding"
      )
    ).toBe(true)

    const emitted = await store.recordExternalSessionEvent({
      externalSessionId: "pg-transcode-123",
      type: "progress",
      data: {
        pct: 0.75,
      },
    })
    const emittedEvents = await store.getRunEvents(run.id)

    expect(emitted).toMatchObject({
      status: "recorded",
      runId: run.id,
      stepKey: "submit",
      attemptId: submitAttempt?.id,
    })
    expect(
      emittedEvents.some(
        (event) =>
          event.eventType === "step.emit:progress" &&
          event.payload.type === "progress" &&
          event.payload.stepAttemptId === submitAttempt?.id
      )
    ).toBe(true)

    const resumed = await engine.resumeExternalSession({
      externalSessionId: "pg-transcode-123",
      payload: {
        outputUrl: "s3://demo/out.mp4",
      },
    })
    await drainEngine(engine)

    const completedRun = await store.getRun(run.id)
    const resumedWaitRows = await pool.query<{
      status: string
      resume_payload: { outputUrl: string } | null
      resume_output: { status: string } | null
    }>(
      `
        SELECT status, resume_payload, resume_output
        FROM workflow_waits
        WHERE run_id = $1
      `,
      [run.id]
    )

    expect(resumed.status).toBe("resumed")
    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.context).toMatchObject({
      externalId: "pg-transcode-123",
      callbackPayload: {
        outputUrl: "s3://demo/out.mp4",
      },
    })
    expect(resumedWaitRows.rows[0]?.status).toBe("resumed")
    expect(resumedWaitRows.rows[0]?.resume_payload).toEqual({
      outputUrl: "s3://demo/out.mp4",
    })
    expect(resumedWaitRows.rows[0]?.resume_output).toEqual({
      status: "complete",
    })
  })

  it("persists and resumes human task waits through the SQL store", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "pg-human-task",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "done",
          timeoutMs: 300_000,
          open: ({ approvalUrl, formUrl }) => ({
            prompt: {
              approvalUrl,
              formUrl,
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
          transitions: {
            timeout: "timed-out",
          },
        }),
        "timed-out": endStep(),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "pg-human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("pg-test-worker", 15_000)

    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })
    expect(wait).toBeTruthy()
    expect(isHumanTaskWaitPayload(wait?.payload)).toBe(true)
    if (!wait || !isHumanTaskWaitPayload(wait.payload)) {
      throw new Error("expected persisted human task wait")
    }

    expect(wait.payload.approvalUrl).toContain("/v1/human-tasks/")
    expect(wait.payload.formUrl).toContain("/human-tasks/")

    const resumed = await engine.resumeHumanTask({
      correlationKey: wait.correlationKey,
      decision: {
        decision: "approve",
        data: {
          reviewer: "pg-alice",
        },
      },
    })
    await drainEngine(engine)

    const completedRun = await store.getRun(run.id)

    expect(resumed.status).toBe("resumed")
    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.context).toMatchObject({
      decision: "approve",
      data: {
        reviewer: "pg-alice",
      },
    })
  })

  it("routes timed-out human task waits through recovery in the SQL store", async () => {
    const store = getStore()
    const workflow = defineWorkflow({
      name: "pg-human-task-timeout",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "done",
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
        "timed-out": endStep(),
        done: endStep(),
      },
    })
    const engine = createWorkflowEngine({
      definitions: [workflow],
      humanTasks: {
        baseUrl: "http://127.0.0.1:3000",
        secret: "pg-human-secret",
        toleranceSeconds: 300,
      },
      metrics: createMetrics(),
      store,
    })

    const run = await engine.startRun({
      workflowName: workflow.name,
      payload: {},
    })

    await engine.tick("pg-test-worker", 15_000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await store.expireOpenWaits({ limit: 100 })).toBeGreaterThan(0)
    await drainEngine(engine)

    const completedRun = await store.getRun(run.id)
    const [wait] = await store.listStepWaits({ runId: run.id, stepKey: "review" })

    expect(completedRun?.status).toBe("completed")
    expect(completedRun?.context.timedOut).toBe(true)
    expect(wait?.status).toBe("expired")
  })
})
