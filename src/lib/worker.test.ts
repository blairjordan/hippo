import { describe, expect, it, vi } from "vitest"

import { startWorkerLoop } from "./worker.js"
import type { WorkflowEngine } from "./workflow-engine.js"

describe("worker loop", () => {
  it("waits for an in-flight tick during shutdown", async () => {
    let resolveTick: (() => void) | undefined
    const tick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve
        }).then(() => null)
    )
    const engine = {
      getWorkflow() {
        throw new Error("not used")
      },
      hasWorkflow() {
        return true
      },
      listWorkflows() {
        return []
      },
      async resumeWait() {
        throw new Error("not used")
      },
      async startRun() {
        throw new Error("not used")
      },
      tick,
    } satisfies WorkflowEngine

    const stop = startWorkerLoop({
      engine,
      workerId: "worker-1",
      pollIntervalMs: 10,
      leaseMs: 5_000,
    })

    expect(tick).toHaveBeenCalledTimes(1)

    const stopPromise = stop()
    expect(tick).toHaveBeenCalledTimes(1)

    resolveTick?.()
    await stopPromise
  })

  it("wakes immediately when the listener notifies", async () => {
    const tick = vi.fn(async () => null)
    let onWake: (() => void) | undefined
    const engine = {
      getWorkflow() {
        throw new Error("not used")
      },
      hasWorkflow() {
        return true
      },
      listWorkflows() {
        return []
      },
      async resumeWait() {
        throw new Error("not used")
      },
      async startRun() {
        throw new Error("not used")
      },
      tick,
    } satisfies WorkflowEngine

    const stop = startWorkerLoop({
      engine,
      workerId: "worker-1",
      pollIntervalMs: 10_000,
      leaseMs: 5_000,
      listenForWakeups: async (listener) => {
        onWake = listener
        return async () => undefined
      },
    })

    expect(tick).toHaveBeenCalledTimes(1)

    await new Promise((resolve) => setTimeout(resolve, 0))
    onWake?.()
    await new Promise((resolve) => setTimeout(resolve, 20))
    await stop()

    expect(tick).toHaveBeenCalledTimes(2)
  })
})
