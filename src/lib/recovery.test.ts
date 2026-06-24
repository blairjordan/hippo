import { describe, expect, it, vi } from "vitest"

import { createMetrics } from "./metrics.js"
import { runRecoveryPass, startRecoveryLoop } from "./recovery.js"

const getCounterValue = async (
  metricName: string,
  metrics: ReturnType<typeof createMetrics>
) => {
  const output = await metrics.registry.metrics()
  const line = output
    .split("\n")
    .find(
      (candidate) =>
        candidate.startsWith(`${metricName} `) ||
        candidate.startsWith(`${metricName}{`)
    )

  if (!line) {
    throw new Error(`Metric "${metricName}" was not found`)
  }

  return Number(line.trim().split(/\s+/).at(-1))
}

describe("recovery", () => {
  it("records reclaimed leases in metrics", async () => {
    const metrics = createMetrics()
    const store = {
      async recoverExpiredLeases() {
        return 3
      },
      async expireOpenWaits() {
        return 0
      },
    }

    const reclaimed = await runRecoveryPass({
      limit: 100,
      metrics,
      store: store as never,
    })

    expect(reclaimed).toBe(3)
    expect(await getCounterValue("hippo_lease_reclaims_total", metrics)).toBe(3)
    expect(await getCounterValue("hippo_recovery_actions_total", metrics)).toBe(3)
  })

  it("waits for an in-flight recovery pass during shutdown", async () => {
    let resolvePass: (() => void) | undefined
    const recoverExpiredLeases = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          resolvePass = () => resolve(1)
        })
    )
    const expireOpenWaits = vi.fn(async () => 0)

    const stop = startRecoveryLoop({
      intervalMs: 10,
      limit: 100,
      metrics: createMetrics(),
      store: {
        recoverExpiredLeases,
        expireOpenWaits,
      } as never,
    })

    expect(recoverExpiredLeases).toHaveBeenCalledTimes(1)

    const stopPromise = stop()
    resolvePass?.()
    await stopPromise
  })
})
