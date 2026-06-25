import { CronExpressionParser } from "cron-parser"

import type { WorkflowEngine } from "./workflow-engine.js"
import type { WorkflowStore } from "./workflow-store.js"

const getNextFireAt = (cronExpression: string, currentDate: Date) =>
  CronExpressionParser.parse(cronExpression, {
    currentDate,
  })
    .next()
    .toDate()

export const startScheduleLoop = (args: {
  engine: WorkflowEngine
  intervalMs: number
  limit: number
  onError?: (error: unknown) => void
  store: WorkflowStore
}) => {
  let active = true
  let inFlight = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlightPromise: Promise<void> | null = null

  const schedule = () => {
    if (!active) {
      return
    }

    timer = setTimeout(() => {
      timer = null
      void tick()
    }, args.intervalMs)
  }

  const tick = async () => {
    if (!active || inFlight) {
      schedule()
      return
    }

    inFlight = true
    inFlightPromise = (async () => {
      try {
        const schedules = await args.store.fireDueSchedules({
          limit: args.limit,
          getNextFireAt: ({ schedule, now }) =>
            getNextFireAt(schedule.cronExpression, now),
        })

        for (const workflowSchedule of schedules) {
          if (!args.engine.hasWorkflow(workflowSchedule.workflowName)) {
            continue
          }

          await args.engine.startRun({
            workflowName: workflowSchedule.workflowName,
            payload: workflowSchedule.payload,
            taskQueue: workflowSchedule.taskQueue,
            priority: workflowSchedule.priority,
          })
        }
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

  void tick()

  return async () => {
    active = false

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    await inFlightPromise
  }
}

export const computeNextScheduleFireAt = (args: {
  cronExpression: string
  currentDate?: Date
}) => getNextFireAt(args.cronExpression, args.currentDate ?? new Date())
