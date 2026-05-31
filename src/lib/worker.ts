import type { WorkflowEngine } from "./workflow-engine.js"

export const startWorkerLoop = (args: {
  engine: WorkflowEngine
  workerId: string
  pollIntervalMs: number
  leaseMs: number
  onError?: (error: unknown) => void
}) => {
  let active = true
  let inFlight = false

  const schedule = () => {
    if (!active) {
      return
    }

    setTimeout(() => {
      void tick()
    }, args.pollIntervalMs)
  }

  const tick = async () => {
    if (!active || inFlight) {
      schedule()
      return
    }

    inFlight = true

    try {
      await args.engine.tick(args.workerId, args.leaseMs)
    } catch (error) {
      args.onError?.(error)
    } finally {
      inFlight = false
      schedule()
    }
  }

  void tick()

  return () => {
    active = false
  }
}
