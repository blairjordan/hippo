import type { WorkflowEngine } from "./workflow-engine.js"

export const startWorkerLoop = (args: {
  engine: WorkflowEngine
  workerId: string
  taskQueues: string[]
  pollIntervalMs: number
  leaseMs: number
  listenForWakeups?: (onWake: () => void) => Promise<() => Promise<void>>
  onError?: (error: unknown) => void
}) => {
  let active = true
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlightPromise: Promise<void> | null = null
  let stopListeningPromise: Promise<(() => Promise<void>) | null> =
    Promise.resolve(null)

  const schedule = (delayMs = args.pollIntervalMs) => {
    if (!active) {
      return
    }

    timer = setTimeout(() => {
      timer = null
      void tick()
    }, delayMs)
  }

  const wake = () => {
    if (!active) {
      return
    }

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    void tick()
  }

  const tick = async () => {
    if (!active || inFlight) {
      schedule()
      return
    }

    inFlight = true
    inFlightPromise = (async () => {
      try {
        await args.engine.tick(args.workerId, args.leaseMs, args.taskQueues)
      } catch (error) {
        args.onError?.(error)
      } finally {
        inFlight = false
        inFlightPromise = null
        schedule()
      }
    })()

    await inFlightPromise
  }

  if (args.listenForWakeups) {
    stopListeningPromise = args.listenForWakeups(() => {
      wake()
    }).catch((error: unknown) => {
      args.onError?.(error)
      return null
    })
  }

  void tick()

  return async () => {
    active = false

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    const stopListening = await stopListeningPromise
    await stopListening?.()
    await inFlightPromise
  }
}
