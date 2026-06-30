import { afterAll, describe, expect, it, vi } from "vitest"

import { createApp } from "./app.js"
import {
  createApiAuthenticator,
  createCallbackAuthenticator,
  signCallbackBody,
} from "./lib/auth.js"
import { signHumanTaskToken } from "./lib/engine/human-task.js"
import { createMetrics } from "./lib/metrics.js"
import { createHippoTracer } from "./lib/tracing.js"
import { createRecordingTracer } from "./lib/tracing.test-helpers.js"
import { createWorkflowEngine } from "./lib/workflow-engine.js"
import { demoWorkflow } from "./workflows/demo.js"
import { defineWorkflow, humanTask, taskStep, endStep } from "./lib/workflow-definition.js"
import type { JsonObject, JsonValue } from "./types/json.js"
import type {
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkflowStepAttemptRecord,
} from "./types/workflow.js"

const createRunRecord = (
  overrides: Partial<WorkflowRunRecord> = {}
): WorkflowRunRecord => ({
  id: "run-1",
  parentRunId: null,
  parentStepKey: null,
  continuedFromRunId: null,
  branchedFromRunId: null,
  branchedFromAttemptRunId: null,
  branchedFromAttemptId: null,
  supersededByRunId: null,
  definitionName: demoWorkflow.name,
  definitionVersion: demoWorkflow.version,
  taskQueue: "default",
  priority: 0,
  status: "queued",
  currentStepKey: "wait-for-webhook",
  input: {},
  context: {},
  result: null,
  error: null,
  leaseOwner: null,
  leaseExpiresAt: null,
  cancelRequestedAt: null,
  cancelMode: null,
  availableAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: null,
  ...overrides,
})

const createAuth = (args?: {
  apiToken?: string
  callbackSecret?: string
}) => ({
  verifyApiRequest: createApiAuthenticator(args?.apiToken),
  verifyCallbackRequest: createCallbackAuthenticator({
    secret: args?.callbackSecret,
    toleranceSeconds: 300,
  }),
})

const createStoreStub = (healthy: boolean | Error = true) => ({
  async advanceTaskStep() {
    throw new Error("not used")
  },
  async beginStepAttempt() {
    throw new Error("not used")
  },
  async branchRun() {
    return createRunRecord({
      id: "run-branched",
      currentStepKey: "send-email",
      status: "queued",
    })
  },
  async cancelRun() {
    return createRunRecord({ status: "canceled" })
  },
  async cancelRunAtBoundary() {
    return createRunRecord({ status: "canceled" })
  },
  async claimNextRunnableRun() {
    return null
  },
  async claimOutboxMessages() {
    return []
  },
  async completeRun() {
    throw new Error("not used")
  },
  async continueAsNew() {
    throw new Error("not used")
  },
  async completeStepAttempt() {
    throw new Error("not used")
  },
  async consumeSignal() {
    return null
  },
  async countOpenWaits() {
    return 0
  },
  async createSignal(args: { runId: string }) {
    return args.runId
  },
  async createSchedule() {
    throw new Error("not used")
  },
  async enqueueOutbox() {
    return undefined
  },
  async extendLease() {
    return true
  },
  async emitStepEvent() {
    throw new Error("not used")
  },
  async executeTransactionalTask() {
    throw new Error("not used")
  },
  async expireOpenWaits() {
    return 0
  },
  async failRun() {
    throw new Error("not used")
  },
  async failStepAttempt() {
    throw new Error("not used")
  },
  async fireDueSchedules() {
    return []
  },
  async getChildRun() {
    return null
  },
  async getRun() {
    return null
  },
  async getRunAttempts(): Promise<WorkflowStepAttemptRecord[]> {
    return []
  },
  async getRunEvents(): Promise<WorkflowEventRecord[]> {
    return []
  },
  async getRunUsage() {
    return []
  },
  async listActiveRuns() {
    return []
  },
  async listChildRuns() {
    return []
  },
  async listStepWaits() {
    return []
  },
  async listFailedRuns() {
    return []
  },
  async listOpenExternalSessions() {
    return []
  },
  async listRunLineage(runId: string) {
    return [createRunRecord({ id: runId })]
  },
  async listRuns() {
    return []
  },
  async listRunsPaginated() {
    return []
  },
  async listSchedules() {
    return []
  },
  async listStuckRuns() {
    return []
  },
  async markOutboxDelivered() {
    return true
  },
  async markRunCompensationFailed() {
    return createRunRecord({ status: "compensation_failed" })
  },
  async openWait() {
    throw new Error("not used")
  },
  async openFanOutWaits() {
    throw new Error("not used")
  },
  async ping() {
    if (healthy instanceof Error) {
      throw healthy
    }

    return healthy
  },
  async recordExternalHeartbeat() {
    return {
      status: "missing" as const,
      runId: null,
      stepKey: null,
      attemptId: null,
    }
  },
  async recordExternalSessionEvent() {
    return {
      status: "missing" as const,
      runId: null,
      stepKey: null,
      attemptId: null,
      eventId: null,
    }
  },
  async recordUsage() {
    return {
      id: "usage-1",
      runId: "run-1",
      stepAttemptId: null,
      resource: "tokens",
      amount: 1,
      costUsd: null,
      dimension: null,
      recordedAt: new Date(),
    }
  },
  async recoverExpiredLeases() {
    return 0
  },
  async requestCancelRun() {
    return createRunRecord({ status: "queued", cancelRequestedAt: new Date(), cancelMode: "graceful" })
  },
  async resumeWait() {
    return { status: "missing" as const, run: null }
  },
  async resumeExternalSession() {
    return { status: "missing" as const, run: null }
  },
  async consumeSignalAndResumeWait() {
    return { status: "missing" as const, run: null }
  },
  async retryRun() {
    return createRunRecord({
      status: "queued",
      currentStepKey: "delivery-confirmation",
    })
  },
  async scheduleRetry() {
    throw new Error("not used")
  },
  async scheduleSleep() {
    throw new Error("not used")
  },
  async queryStepDatabase() {
    return { rows: [] }
  },
  async startRun(args: {
    parentRunId?: string | null
    parentStepKey?: string | null
    definitionName: string
    definitionVersion: number
    taskQueue: string
    priority: number
    input: JsonObject
    currentStepKey: string
    idempotencyKey?: string | null
    traceContext?: string | null
  }) {
    return createRunRecord({
      parentRunId: args.parentRunId ?? null,
      parentStepKey: args.parentStepKey ?? null,
      definitionName: args.definitionName,
      definitionVersion: args.definitionVersion,
      taskQueue: args.taskQueue,
      priority: args.priority,
      currentStepKey: args.currentStepKey,
      input: args.input,
    })
  },
  async wakeParentForChild() {
    return false
  },
  async getRunKV() {
    return null
  },
  async setRunKV() {
    return
  },
  async deleteRunKV() {
    return
  },
})

describe("app routes", () => {
  const app = createApp({
    auth: createAuth(),
    engine: createWorkflowEngine({
      definitions: [demoWorkflow],
      metrics: createMetrics(),
      store: createStoreStub(),
    }),
    metrics: createMetrics(),
    store: createStoreStub(),
  })

  afterAll(async () => {
    await app.close()
  })

  it("returns 404 for an unknown workflow", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/workflows/missing/render",
    })

    expect(response.statusCode).toBe(404)
  })

  it("returns healthz pass when the store can ping", async () => {
    const healthyApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: createStoreStub(true),
      }),
      metrics: createMetrics(),
      store: createStoreStub(true),
    })

    const response = await healthyApp.inject({
      method: "GET",
      url: "/healthz",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: "pass" })

    await healthyApp.close()
  })

  it("returns healthz fail when the store ping rejects", async () => {
    const failingApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: createStoreStub(new Error("db down")),
      }),
      metrics: createMetrics(),
      store: createStoreStub(new Error("db down")),
    })

    const response = await failingApp.inject({
      method: "GET",
      url: "/healthz",
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toEqual({ status: "fail" })

    await failingApp.close()
  })

  it("renders the dashboard skeleton", async () => {
    const redirectResponse = await app.inject({
      method: "GET",
      url: "/dashboard",
    })
    expect(redirectResponse.statusCode).toBe(302)
    expect(redirectResponse.headers.location).toBe("/dashboard/runs")

    const runsResponse = await app.inject({
      method: "GET",
      url: "/dashboard/runs",
    })
    expect(runsResponse.statusCode).toBe(200)
    expect(runsResponse.headers["content-type"]).toContain("text/html")
    expect(runsResponse.body).toContain("Hippo")
    expect(runsResponse.body).toContain("Runs")
    expect(runsResponse.body).toContain("Definitions")
    expect(runsResponse.body).toContain('data-theme-toggle')
    expect(runsResponse.body).toContain("hippo-dashboard-theme")

    const definitionResponse = await app.inject({
      method: "GET",
      url: "/dashboard/definitions/demo-delivery",
    })
    expect(definitionResponse.statusCode).toBe(200)
    expect(definitionResponse.headers["content-type"]).toContain("text/html")
    expect(definitionResponse.body).toContain('class="mermaid"')
    expect(definitionResponse.body).toContain("data-mount-id")
    expect(definitionResponse.body).toContain('/v1/workflows/demo-delivery/render')
    expect(definitionResponse.body).toContain("hippo-dashboard-theme")
    expect(definitionResponse.body).toContain("cdn.jsdelivr.net/npm/mermaid")
  })

  it("renders a run detail dashboard page", async () => {
    const runStore = {
      ...createStoreStub(),
      async getRun() {
        return createRunRecord({
          currentStepKey: "delivery-confirmation",
          status: "waiting",
        })
      },
      async getRunAttempts(): Promise<WorkflowStepAttemptRecord[]> {
        return [
          {
            id: "attempt-1",
            runId: "run-1",
            stepKey: "send-email",
            kind: "forward",
            stepSeq: 1,
            attempt: 1,
            status: "completed",
            contextBefore: {},
            input: {},
            output: { accepted: true },
            error: null,
            startedAt: new Date(),
            lastHeartbeatAt: null,
            completedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]
      },
      async getRunEvents(): Promise<WorkflowEventRecord[]> {
        return [
          {
            id: 1,
            runId: "run-1",
            stepKey: "send-email",
            eventType: "step.completed",
            payload: { nextStepKey: "delivery-confirmation" },
            createdAt: new Date(),
          },
        ]
      },
      async listRunLineage() {
        return [
          createRunRecord({
            id: "run-0",
            currentStepKey: null,
            status: "completed",
          }),
          createRunRecord({
            id: "run-1",
            branchedFromRunId: "run-0",
            branchedFromAttemptRunId: "run-0",
            branchedFromAttemptId: "attempt-1",
            status: "waiting",
          }),
        ]
      },
    }
    const runApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: runStore,
      }),
      metrics: createMetrics(),
      store: runStore,
    })

    const response = await runApp.inject({
      method: "GET",
      url: "/dashboard/runs/11111111-1111-4111-8111-111111111111",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/html")
    expect(response.body).toContain("Live events")
    expect(response.body).toContain("Lineage")
    expect(response.body).toContain('data-theme-toggle')
    expect(response.body).toContain('class="mermaid"')
    expect(response.body).toContain("data-mount-id")
    expect(response.body).toContain('data-step-key="send-email"')
    expect(response.body).toContain("class step_5_delivery_confirmation currentStep")
    expect(response.body).toContain("/v1/runs/run-1/stream?afterEventId=1")

    await runApp.close()
  })

  it("treats duplicate wait resumes as idempotent success", async () => {
    const duplicateStore = {
      ...createStoreStub(),
      async resumeWait() {
        return {
          status: "duplicate" as const,
          run: createRunRecord({
            status: "queued",
            currentStepKey: "wait-for-webhook",
          }),
        }
      },
    }
    const duplicateApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: duplicateStore,
      }),
      metrics: createMetrics(),
      store: duplicateStore,
    })

    const response = await duplicateApp.inject({
      method: "POST",
      url: "/v1/waits/abc123/resume",
      payload: { payload: { ok: true } },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      outcome: "duplicate",
      runId: "run-1",
      status: "queued",
      currentStepKey: "wait-for-webhook",
    })

    await duplicateApp.close()
  })

  it("resumes an external session callback by external id", async () => {
    const externalStore = {
      ...createStoreStub(),
      async resumeExternalSession() {
        return {
          status: "resumed" as const,
          run: createRunRecord({
            status: "queued",
            currentStepKey: "done",
          }),
        }
      },
    }
    const externalApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: externalStore,
      }),
      metrics: createMetrics(),
      store: externalStore,
    })

    const response = await externalApp.inject({
      method: "POST",
      url: "/v1/external-sessions/job-123/resume",
      payload: { payload: { ok: true } },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      outcome: "resumed",
      runId: "run-1",
      status: "queued",
      currentStepKey: "done",
    })

    await externalApp.close()
  })

  it("records an external session heartbeat by external id", async () => {
    let capturedHeartbeat: {
      externalSessionId: string
      leaseMs: number
      payload: JsonObject
    } | null = null
    let capturedUsage: {
      runId: string
      stepKey: string | null
      stepAttemptId: string | null
      usage: JsonObject
    } | null = null
    const heartbeatStore = {
      ...createStoreStub(),
      async getRun() {
        return createRunRecord()
      },
      async recordExternalHeartbeat(args: {
        externalSessionId: string
        leaseMs: number
        payload: JsonObject
      }) {
        capturedHeartbeat = args
        return {
          status: "recorded" as const,
          runId: "run-1",
          stepKey: "transcode",
          attemptId: "attempt-1",
        }
      },
      async recordUsage(args: {
        runId: string
        stepKey: string | null
        stepAttemptId: string | null
        usage: JsonObject
      }) {
        capturedUsage = args
        return {
          id: "usage-1",
          runId: args.runId,
          stepAttemptId: args.stepAttemptId,
          resource: String(args.usage.resource),
          amount: Number(args.usage.amount),
          costUsd: null,
          dimension: null,
          recordedAt: new Date(),
        }
      },
    }
    const heartbeatApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: heartbeatStore,
      }),
      externalHeartbeatLeaseMs: 30_000,
      metrics: createMetrics(),
      store: heartbeatStore,
    })

    const response = await heartbeatApp.inject({
      method: "POST",
      url: "/v1/external-sessions/job-123/heartbeat",
      payload: {
        progress: 0.5,
        message: "halfway",
        usage: {
          resource: "tokens",
          amount: 42,
        },
      },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      outcome: "recorded",
      runId: "run-1",
      stepKey: "transcode",
      attemptId: "attempt-1",
    })
    expect(capturedHeartbeat).toEqual({
      externalSessionId: "job-123",
      leaseMs: 30_000,
      payload: {
        progress: 0.5,
        message: "halfway",
        usage: {
          resource: "tokens",
          amount: 42,
        },
      },
    })
    expect(capturedUsage).toMatchObject({
      runId: "run-1",
      stepKey: "transcode",
      stepAttemptId: "attempt-1",
      usage: {
        resource: "tokens",
        amount: 42,
      },
    })

    await heartbeatApp.close()
  })

  it("records external session events by external id", async () => {
    const capturedEvents: Array<{
      externalSessionId: string
      type: string
      data: JsonValue
    }> = []
    const eventsStore = {
      ...createStoreStub(),
      async recordExternalSessionEvent(args: {
        externalSessionId: string
        type: string
        data: JsonValue
      }) {
        capturedEvents.push(args)
        return {
          status: "recorded" as const,
          runId: "run-1",
          stepKey: "transcode",
          attemptId: "attempt-1",
          eventId: capturedEvents.length,
        }
      },
    }
    const eventsApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: eventsStore,
      }),
      metrics: createMetrics(),
      store: eventsStore,
    })

    const response = await eventsApp.inject({
      method: "POST",
      url: "/v1/external-sessions/job-123/events",
      payload: {
        events: [
          {
            type: "progress",
            data: { pct: 0.75 },
          },
          {
            type: "log-line",
            data: "encoded frame 42",
          },
        ],
      },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toMatchObject({
      outcome: "recorded",
      count: 2,
      events: [
        {
          runId: "run-1",
          stepKey: "transcode",
          attemptId: "attempt-1",
          eventId: 1,
        },
        {
          runId: "run-1",
          stepKey: "transcode",
          attemptId: "attempt-1",
          eventId: 2,
        },
      ],
    })
    expect(capturedEvents).toEqual([
      {
        externalSessionId: "job-123",
        type: "progress",
        data: { pct: 0.75 },
      },
      {
        externalSessionId: "job-123",
        type: "log-line",
        data: "encoded frame 42",
      },
    ])

    await eventsApp.close()
  })

  it("requires an API token when configured", async () => {
    const securedApp = createApp({
      auth: createAuth({ apiToken: "top-secret" }),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: createStoreStub(),
      }),
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    const unauthenticated = await securedApp.inject({
      method: "GET",
      url: "/v1/operators/runs/active",
    })
    const authenticated = await securedApp.inject({
      method: "GET",
      url: "/v1/operators/runs/active",
      headers: {
        authorization: "Bearer top-secret",
      },
    })

    expect(unauthenticated.statusCode).toBe(401)
    expect(authenticated.statusCode).toBe(200)

    await securedApp.close()
  })

  it("lists operator runs with filters", async () => {
    let capturedQuery: {
      limit: number
      statuses?: WorkflowRunRecord["status"][]
      workflowName?: string
      search?: string
      parentRunId?: string
      taskQueue?: string
      afterUpdatedAt?: Date
      afterId?: string
    } | null = null
    const store = {
      ...createStoreStub(),
      async listRunsPaginated(args: {
        limit: number
        statuses?: WorkflowRunRecord["status"][]
        workflowName?: string
        search?: string
        parentRunId?: string
        taskQueue?: string
        afterUpdatedAt?: Date
        afterId?: string
      }) {
        capturedQuery = args
        return [createRunRecord({ id: "run-filtered", status: "running" })]
      },
    }
    const operatorApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await operatorApp.inject({
      method: "GET",
      url: "/v1/operators/runs?limit=10&workflowName=demo-delivery&status=running&taskQueue=priority&search=run&parentRunId=11111111-1111-4111-8111-111111111111",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      runs: [{ id: "run-filtered", status: "running" }],
    })
    expect(capturedQuery).toEqual({
      limit: 11,
      parentRunId: "11111111-1111-4111-8111-111111111111",
      search: "run",
      statuses: ["running"],
      taskQueue: "priority",
      workflowName: "demo-delivery",
    })

    await operatorApp.close()
  })

  it("paginates operator active runs with cursor", async () => {
    const newer = createRunRecord({
      id: "11111111-1111-4111-8111-aaaaaaaaaaaa",
      status: "running",
    })
    const older = createRunRecord({
      id: "11111111-1111-4111-8111-bbbbbbbbbbbb",
      status: "running",
      updatedAt: new Date(newer.updatedAt.getTime() - 1000),
    })
    let capturedArgs: {
      limit: number
      afterUpdatedAt?: Date
      afterId?: string
    } | null = null
    const store = {
      ...createStoreStub(),
      async listActiveRuns(input: {
        limit: number
        afterUpdatedAt?: Date
        afterId?: string
      }) {
        capturedArgs = input
        if (!input.afterUpdatedAt) {
          return [newer, older].slice(0, input.limit)
        }
        return []
      },
    }
    const activeApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const first = await activeApp.inject({
      method: "GET",
      url: "/v1/operators/runs/active?limit=1",
    })
    expect(first.statusCode).toBe(200)
    const firstBody = first.json()
    expect(firstBody.runs).toHaveLength(1)
    expect(firstBody.runs[0].id).toBe(newer.id)
    expect(firstBody.nextCursor).toMatchObject({ afterId: newer.id })
    expect(capturedArgs).toMatchObject({ limit: 2 })

    const next = await activeApp.inject({
      method: "GET",
      url: `/v1/operators/runs/active?limit=1&afterUpdatedAt=${encodeURIComponent(firstBody.nextCursor.afterUpdatedAt)}&afterId=${firstBody.nextCursor.afterId}`,
    })
    expect(next.statusCode).toBe(200)
    expect(next.json()).toEqual({ runs: [], nextCursor: null })
    expect(capturedArgs).toMatchObject({
      limit: 2,
      afterId: newer.id,
    })

    await activeApp.close()
  })

  it("includes workflow projections on run detail", async () => {
    const projectionWorkflow = defineWorkflow({
      name: "projectable-workflow",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          run: () => ({}),
          next: "end",
        }),
        end: endStep(),
      },
      queries: {
        summary: (context) => ({
          customerId: context.customerId ?? null,
          orderTotal: context.orderTotal ?? 0,
        }),
        explode: () => {
          throw new Error("intentional projection failure")
        },
      },
    })

    const run = createRunRecord({
      id: "11111111-1111-4111-8111-cccccccccccc",
      definitionName: "projectable-workflow",
      definitionVersion: 1,
      context: { customerId: "cust-9", orderTotal: 42 },
    })
    const store = {
      ...createStoreStub(),
      async getRun() {
        return run
      },
    }
    const projectionApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [projectionWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await projectionApp.inject({
      method: "GET",
      url: `/v1/runs/${run.id}`,
    })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.projections).toEqual({
      summary: { result: { customerId: "cust-9", orderTotal: 42 } },
      explode: { error: "intentional projection failure" },
    })

    await projectionApp.close()
  })

  it("returns run lineage for operator inspection", async () => {
    const store = {
      ...createStoreStub(),
      async getRun() {
        return createRunRecord({ id: "run-1", status: "completed" })
      },
      async listRunLineage() {
        return [
          createRunRecord({ id: "run-1", status: "completed" }),
          createRunRecord({
            id: "run-2",
            branchedFromRunId: "run-1",
            branchedFromAttemptRunId: "run-1",
            branchedFromAttemptId: "attempt-1",
            status: "queued",
          }),
        ]
      },
    }
    const operatorApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await operatorApp.inject({
      method: "GET",
      url: "/v1/operators/runs/11111111-1111-4111-8111-111111111111/lineage",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      runs: [
        { id: "run-1", status: "completed" },
        { id: "run-2", branchedFromRunId: "run-1", status: "queued" },
      ],
    })

    await operatorApp.close()
  })

  it("requires a signed callback when a callback secret is configured", async () => {
    const callbackSecret = "callback-secret"
    const securedApp = createApp({
      auth: createAuth({ callbackSecret }),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: createStoreStub(),
      }),
      metrics: createMetrics(),
      store: createStoreStub(),
    })
    const payload = { payload: { ok: true } }
    const timestamp = String(Math.floor(Date.now() / 1_000))
    const signature = signCallbackBody({
      body: payload,
      secret: callbackSecret,
      timestamp,
    })

    const unauthenticated = await securedApp.inject({
      method: "POST",
      url: "/v1/waits/abc123/resume",
      payload,
    })
    const authenticated = await securedApp.inject({
      method: "POST",
      url: "/v1/waits/abc123/resume",
      headers: {
        "x-hippo-signature": signature,
        "x-hippo-timestamp": timestamp,
      },
      payload,
    })

    expect(unauthenticated.statusCode).toBe(401)
    expect(authenticated.statusCode).toBe(404)

    await securedApp.close()
  })

  it("rejects invalid human task tokens", async () => {
    const appInstance = createApp({
      auth: createAuth({ callbackSecret: "human-secret" }),
      callbackSecret: "human-secret",
      callbackToleranceSeconds: 300,
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: createStoreStub(),
      }),
      metrics: createMetrics(),
      store: createStoreStub(),
    })

    const response = await appInstance.inject({
      method: "POST",
      url: "/v1/human-tasks/not-a-real-token",
      payload: {
        decision: "approve",
      },
    })

    expect(response.statusCode).toBe(401)

    await appInstance.close()
  })

  it("consumes a human task token only once", async () => {
    const workflow = defineWorkflow({
      name: "human-task-route",
      version: 1,
      startAt: "review",
      steps: {
        review: humanTask({
          next: "done",
          timeoutMs: 60_000,
          open: () => ({
            prompt: {
              reviewer: "alice",
            },
          }),
          resume: (_context, decision) => ({
            patch: {
              decision: decision.decision,
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
    let resumeCount = 0
    let open = true
    const routeStore = {
      ...createStoreStub(),
      async resumeWait(args: {
        correlationKey: string
        payload: JsonValue | undefined
        resume: (
          run: WorkflowRunRecord,
          wait: {
            id: string
            runId: string
            stepKey: string
            correlationKey: string
            status: "open" | "resumed"
            payload: JsonValue | null
            resumePayload: JsonValue | null
            resumeOutput: JsonValue | null
            expiresAt: Date | null
            createdAt: Date
            updatedAt: Date
            resumedAt: Date | null
            externalSessionId: null
            externalSessionKind: null
          }
        ) => Promise<{
          nextStepKey: string
          context: JsonObject
          output: JsonValue | null
        }>
      }) {
        const run = createRunRecord({
          id: "run-human-1",
          definitionName: workflow.name,
          definitionVersion: workflow.version,
          status: open ? "waiting" : "queued",
          currentStepKey: "review",
        })

        if (!open) {
          return {
            status: "duplicate" as const,
            run,
          }
        }

        open = false
        resumeCount += 1
        const resumed = await args.resume(run, {
          id: "wait-1",
          runId: run.id,
          stepKey: "review",
          correlationKey: args.correlationKey,
          status: "open",
          payload: null,
          resumePayload: args.payload ?? null,
          resumeOutput: null,
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
          resumedAt: null,
          externalSessionId: null,
          externalSessionKind: null,
        })

        return {
          status: "resumed" as const,
          run: createRunRecord({
            id: run.id,
            definitionName: workflow.name,
            definitionVersion: workflow.version,
            status: "queued",
            currentStepKey: resumed.nextStepKey,
            context: resumed.context,
          }),
        }
      },
    }
    const appInstance = createApp({
      auth: createAuth({ callbackSecret: "human-secret" }),
      callbackSecret: "human-secret",
      callbackToleranceSeconds: 300,
      engine: createWorkflowEngine({
        definitions: [workflow],
        metrics: createMetrics(),
        store: routeStore,
      }),
      metrics: createMetrics(),
      store: routeStore,
    })
    const token = signHumanTaskToken({
      correlationKey: "human:run-human-1:review",
      expiresAt: new Date(Date.now() + 60_000),
      secret: "human-secret",
    })

    const first = await appInstance.inject({
      method: "POST",
      url: `/v1/human-tasks/${token}`,
      payload: {
        decision: "approve",
      },
    })
    const second = await appInstance.inject({
      method: "POST",
      url: `/v1/human-tasks/${token}`,
      payload: {
        decision: "approve",
      },
    })

    expect(first.statusCode).toBe(202)
    expect(second.statusCode).toBe(200)
    expect(second.json()).toMatchObject({
      outcome: "duplicate",
      runId: "run-human-1",
    })
    expect(resumeCount).toBe(1)

    await appInstance.close()
  })

  it("forwards an idempotency key when creating a run", async () => {
    let capturedIdempotencyKey: string | undefined
    const store = {
      ...createStoreStub(),
      async startRun(args: {
        parentRunId?: string | null
        parentStepKey?: string | null
        definitionName: string
        definitionVersion: number
        taskQueue: string
        priority: number
        input: JsonObject
        currentStepKey: string
        idempotencyKey?: string | null
      }) {
        capturedIdempotencyKey =
          args.idempotencyKey === null ? undefined : args.idempotencyKey

        return createRunRecord({
          definitionName: args.definitionName,
          definitionVersion: args.definitionVersion,
          taskQueue: args.taskQueue,
          priority: args.priority,
          currentStepKey: args.currentStepKey,
          input: args.input,
        })
      },
    }
    const idempotentApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await idempotentApp.inject({
      method: "POST",
      url: "/v1/workflows/demo-delivery/runs",
      headers: {
        "idempotency-key": "customer-start-123",
      },
      payload: {},
    })

    expect(response.statusCode).toBe(202)
    expect(capturedIdempotencyKey).toBe("customer-start-123")

    await idempotentApp.close()
  })

  it("emits nested spans from route to engine to store when starting a run", async () => {
    const store = createStoreStub()
    const recording = createRecordingTracer()
    const tracer = createHippoTracer({
      tracer: recording.tracer,
    })
    const tracedApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
        tracer,
      }),
      metrics: createMetrics(),
      store,
      tracer,
    })

    const response = await tracedApp.inject({
      method: "POST",
      url: "/v1/workflows/demo-delivery/runs",
      payload: {},
    })

    expect(response.statusCode).toBe(202)
    expect(recording.spans.map((span) => span.name)).toEqual([
      "hippo.http.start_run",
      "hippo.http.api_auth",
      "hippo.workflow.start_run",
    ])
    expect(recording.spans[0]?.parentName).toBeNull()
    expect(recording.spans[1]?.parentName).toBe("hippo.http.start_run")
    expect(recording.spans[2]?.parentName).toBe("hippo.http.start_run")

    await tracedApp.close()
  })

  it("returns projected run context fields", async () => {
    const contextStore = {
      ...createStoreStub(),
      async getRun() {
        return createRunRecord({
          context: {
            delivery: {
              status: "waiting",
              provider: "email",
            },
            customerId: "cus_123",
          },
        })
      },
    }
    const contextApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store: contextStore,
      }),
      metrics: createMetrics(),
      store: contextStore,
    })

    const response = await contextApp.inject({
      method: "GET",
      url: "/v1/runs/11111111-1111-4111-8111-111111111111/context?keys=delivery.status,customerId,missing",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      runId: "run-1",
      workflowName: demoWorkflow.name,
      context: {
        "delivery.status": "waiting",
        customerId: "cus_123",
      },
    })

    await contextApp.close()
  })

  it("runs compensation after hard terminate", async () => {
    const run = createRunRecord({
      id: "11111111-1111-4111-8111-222222222222",
      status: "waiting",
      currentStepKey: "delivery-confirmation",
    })
    const runCompensation = vi.fn(async () =>
      createRunRecord({
        id: run.id,
        status: "canceled",
        currentStepKey: run.currentStepKey,
      })
    )
    const engine = {
      async cancelExternalSessionsForRun() {
        return { attempted: 0 }
      },
      getWorkflow() {
        throw new Error("not used")
      },
      hasWorkflow() {
        return true
      },
      listWorkflows() {
        return []
      },
      listWorkflowVersions() {
        return []
      },
      replaceDefinitions() {
        return []
      },
      async resumeWait() {
        throw new Error("not used")
      },
      async resumeHumanTask() {
        throw new Error("not used")
      },
      async resumeExternalSession() {
        throw new Error("not used")
      },
      runCompensation,
      async startRun() {
        throw new Error("not used")
      },
      async tick() {
        return null
      },
    }
    const store = {
      ...createStoreStub(),
      async getRun() {
        return run
      },
      async listChildRuns() {
        return []
      },
      async requestCancelRun() {
        return createRunRecord({
          id: run.id,
          status: "canceled",
          currentStepKey: run.currentStepKey,
          cancelRequestedAt: new Date(),
          cancelMode: "hard",
        })
      },
    }
    const terminateApp = createApp({
      auth: createAuth(),
      engine,
      metrics: createMetrics(),
      store,
    })

    const response = await terminateApp.inject({
      method: "POST",
      url: `/v1/operators/runs/${run.id}/terminate`,
      payload: { reason: "operator request" },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      runId: run.id,
      status: "canceled",
      currentStepKey: "delivery-confirmation",
    })
    expect(runCompensation).toHaveBeenCalledWith(run.id)

    await terminateApp.close()
  })

  it("rewinds a terminal run from a prior attempt", async () => {
    const run = createRunRecord({
      id: "11111111-1111-4111-8111-333333333333",
      status: "failed",
      currentStepKey: "delivery-confirmation",
    })
    const branchRun = vi.fn(async () =>
      createRunRecord({
        id: "22222222-2222-4222-8222-222222222222",
        branchedFromRunId: run.id,
        branchedFromAttemptId: "attempt-1",
        currentStepKey: "send-email",
        status: "queued",
      })
    )
    const store = {
      ...createStoreStub(),
      branchRun,
      async getRun() {
        return run
      },
    }
    const rewindApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await rewindApp.inject({
      method: "POST",
      url: `/v1/operators/runs/${run.id}/rewind`,
      payload: { toAttemptId: "11111111-1111-4111-8111-444444444444" },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({
      runId: "22222222-2222-4222-8222-222222222222",
      sourceRunId: run.id,
      status: "queued",
      currentStepKey: "send-email",
    })
    expect(branchRun).toHaveBeenCalledWith({
      runId: run.id,
      attemptId: "11111111-1111-4111-8111-444444444444",
      mode: "rewind",
    })

    await rewindApp.close()
  })

  it("forks a terminal run from a prior attempt", async () => {
    const run = createRunRecord({
      id: "11111111-1111-4111-8111-555555555555",
      status: "completed",
      currentStepKey: null,
    })
    const branchRun = vi.fn(async () =>
      createRunRecord({
        id: "22222222-2222-4222-8222-666666666666",
        branchedFromRunId: run.id,
        branchedFromAttemptId: "attempt-2",
        currentStepKey: "send-webhook",
        status: "queued",
      })
    )
    const store = {
      ...createStoreStub(),
      branchRun,
      async getRun() {
        return run
      },
    }
    const forkApp = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [demoWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await forkApp.inject({
      method: "POST",
      url: `/v1/operators/runs/${run.id}/fork`,
      payload: { fromAttemptId: "11111111-1111-4111-8111-777777777777" },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({
      runId: "22222222-2222-4222-8222-666666666666",
      sourceRunId: run.id,
      status: "queued",
      currentStepKey: "send-webhook",
    })
    expect(branchRun).toHaveBeenCalledWith({
      runId: run.id,
      attemptId: "11111111-1111-4111-8111-777777777777",
      mode: "fork",
    })

    await forkApp.close()
  })

  it("executes workflow-owned query projections", async () => {
    const queryWorkflow = defineWorkflow({
      name: "queryable-workflow",
      version: 1,
      startAt: "first",
      steps: {
        first: taskStep({
          kind: "task",
          run: () => ({}),
          next: "end",
        }),
        end: endStep(),
      },
      queries: {
        getCustomerId: (context) => context.customerId || "anonymous",
      },
    })

    const run = createRunRecord({
      id: "11111111-1111-4111-8111-222222222222",
      definitionName: "queryable-workflow",
      definitionVersion: 1,
      context: { customerId: "cust-123" },
    })

    const store = {
      ...createStoreStub(),
      async getRun() {
        return run
      },
    }

    const appInstance = createApp({
      auth: createAuth(),
      engine: createWorkflowEngine({
        definitions: [queryWorkflow],
        metrics: createMetrics(),
        store,
      }),
      metrics: createMetrics(),
      store,
    })

    const response = await appInstance.inject({
      method: "GET",
      url: `/v1/runs/${run.id}/query/getCustomerId`,
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      runId: run.id,
      workflowName: run.definitionName,
      queryName: "getCustomerId",
      result: "cust-123",
    })

    // Query non-existent projection
    const badQueryResponse = await appInstance.inject({
      method: "GET",
      url: `/v1/runs/${run.id}/query/unknownQuery`,
    })
    expect(badQueryResponse.statusCode).toBe(404)

    await appInstance.close()
  })
})
