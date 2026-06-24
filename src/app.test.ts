import { afterAll, describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import {
  createApiAuthenticator,
  createCallbackAuthenticator,
  signCallbackBody,
} from "./lib/auth.js"
import { createMetrics } from "./lib/metrics.js"
import { createWorkflowEngine } from "./lib/workflow-engine.js"
import { demoWorkflow } from "./workflows/demo.js"
import type { JsonObject } from "./types/json.js"
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
  definitionName: demoWorkflow.name,
  definitionVersion: demoWorkflow.version,
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
  async executeTransactionalTask() {
    throw new Error("not used")
  },
  async expireOpenWaits() {
    return 0
  },
  async failRun() {
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
  async listActiveRuns() {
    return []
  },
  async listChildRuns() {
    return []
  },
  async listFailedRuns() {
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
  async openWait() {
    throw new Error("not used")
  },
  async ping() {
    if (healthy instanceof Error) {
      throw healthy
    }

    return healthy
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
    input: JsonObject
    currentStepKey: string
  }) {
    return createRunRecord({
      parentRunId: args.parentRunId ?? null,
      parentStepKey: args.parentStepKey ?? null,
      definitionName: args.definitionName,
      definitionVersion: args.definitionVersion,
      currentStepKey: args.currentStepKey,
      input: args.input,
    })
  },
  async wakeParentForChild() {
    return false
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
    const response = await app.inject({
      method: "GET",
      url: "/dashboard",
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers["content-type"]).toContain("text/html")
    expect(response.body).toContain("Hippo dashboard")
    expect(response.body).toContain("Workflow definitions")
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
            attempt: 1,
            status: "completed",
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
})
