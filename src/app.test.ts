import { afterAll, describe, expect, it } from "vitest"

import { createApp } from "./app.js"
import { createMetrics } from "./lib/metrics.js"
import { createWorkflowEngine } from "./lib/workflow-engine.js"
import { demoWorkflow } from "./workflows/demo.js"

const createStoreStub = (healthy = true) => ({
  async advanceTaskStep() {
    throw new Error("not used")
  },
  async beginStepAttempt() {
    throw new Error("not used")
  },
  async claimNextRunnableRun() {
    return null
  },
  async completeRun() {
    throw new Error("not used")
  },
  async countOpenWaits() {
    return 0
  },
  async failRun() {
    throw new Error("not used")
  },
  async getRun() {
    return null
  },
  async getRunEvents() {
    return []
  },
  async openWait() {
    throw new Error("not used")
  },
  async ping() {
    return healthy
  },
  async resumeWait() {
    return null
  },
  async scheduleRetry() {
    throw new Error("not used")
  },
  async scheduleSleep() {
    throw new Error("not used")
  },
  async startRun() {
    throw new Error("not used")
  },
})

describe("app routes", () => {
  const app = createApp({
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
})
