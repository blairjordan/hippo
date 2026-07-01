import { createHippoTracer, type HippoTracer, type TraceAttributes } from "./tracing.js"
import type { Database } from "./db.js"
import type { StoreContext } from "./store/context.js"
import { createBudgetMethods } from "./store/budget.js"
import { createKVMethods } from "./store/kv.js"
import { createOutboxMethods } from "./store/outbox.js"
import { createScheduleMethods } from "./store/schedules.js"
import { createSignalMethods } from "./store/signals.js"
import { createOperatorQueries } from "./store/operator-queries.js"
import { createRunsMethods } from "./store/runs.js"
import { createRunControlMethods } from "./store/run-control.js"
import { createWaitsMethods } from "./store/waits.js"
import { createAttemptsMethods } from "./store/attempts.js"
import { createExecutionMethods } from "./store/execution.js"
import { createUsageMethods } from "./store/usage.js"

export { BudgetExceededError, LostLeaseError } from "./store/budget.js"

export const createWorkflowStore = (
  db: Database,
  options: {
    notifyRunnable?: () => Promise<void>
    notifyRunEvent?: (runId: string) => Promise<void>
    tracer?: HippoTracer
  } = {}
) => {
  const tracer = options.tracer ?? createHippoTracer()
  const notifyRunnable = async () => {
    await options.notifyRunnable?.()
  }

  const notifyRunEvent = async (runId: string) => {
    await options.notifyRunEvent?.(runId)
  }

  const withStoreSpan = <T>(
    input: {
      name: string
      attributes?: TraceAttributes
    },
    run: () => Promise<T>
  ) =>
    tracer.withSpan(
      {
        name: `hippo.store.${input.name}`,
        ...(input.attributes === undefined
          ? {}
          : { attributes: input.attributes }),
      },
      run
    )

  const self: any = {}

  const context: StoreContext = {
    db,
    tracer,
    notifyRunnable,
    notifyRunEvent,
    withStoreSpan,
    self,
  }

  const budget = createBudgetMethods(context)
  const kv = createKVMethods(context)
  const outbox = createOutboxMethods(context)
  const schedules = createScheduleMethods(context)
  const signals = createSignalMethods(context)
  const operatorQueries = createOperatorQueries(context)
  const runs = createRunsMethods(context)
  const runControl = createRunControlMethods(context)
  const waits = createWaitsMethods(context)
  const attempts = createAttemptsMethods(context)
  const execution = createExecutionMethods(context)
  const usage = createUsageMethods(context)

  Object.assign(self, {
    ...budget,
    ...kv,
    ...outbox,
    ...schedules,
    ...signals,
    ...operatorQueries,
    ...runs,
    ...runControl,
    ...waits,
    ...attempts,
    ...execution,
    ...usage,
  })

  return {
    advanceTaskStep: attempts.advanceTaskStep,
    beginStepAttempt: attempts.beginStepAttempt,
    branchRun: runs.branchRun,
    cancelRun: runControl.cancelRun,
    cancelRunAtBoundary: runControl.cancelRunAtBoundary,
    claimNextRunnableRun: runControl.claimNextRunnableRun,
    claimOutboxMessages: outbox.claimOutboxMessages,
    completeStepAttempt: attempts.completeStepAttempt,
    completeRun: runs.completeRun,
    continueAsNew: runs.continueAsNew,
    countOpenWaits: waits.countOpenWaits,
    createSchedule: schedules.createSchedule,
    createSignal: signals.createSignal,
    consumeSignal: signals.consumeSignal,
    enqueueOutbox: outbox.enqueueOutbox,
    extendLease: runControl.extendLease,
    emitStepEvent: attempts.emitStepEvent,
    executeTransactionalTask: execution.executeTransactionalTask,
    expireOpenWaits: waits.expireOpenWaits,
    failStepAttempt: attempts.failStepAttempt,
    failRun: runs.failRun,
    fireDueSchedules: schedules.fireDueSchedules,
    getChildRun: runs.getChildRun,
    getRun: runs.getRun,
    getRunAttempts: attempts.getRunAttempts,
    getRunEvents: runs.getRunEvents,
    getRunUsage: usage.getRunUsage,
    listChildRuns: operatorQueries.listChildRuns,
    listStepWaits: waits.listStepWaits,
    openFanOutWaits: waits.openFanOutWaits,
    openWait: waits.openWait,
    ping: runControl.ping,
    listActiveRuns: operatorQueries.listActiveRuns,
    listFailedRuns: operatorQueries.listFailedRuns,
    listRunLineage: operatorQueries.listRunLineage,
    listOpenExternalSessions: waits.listOpenExternalSessions,
    listRuns: operatorQueries.listRuns,
    listRunsPaginated: operatorQueries.listRunsPaginated,
    listSchedules: schedules.listSchedules,
    deleteSchedule: schedules.deleteSchedule,
    updateScheduleActive: schedules.updateScheduleActive,
    listStuckRuns: operatorQueries.listStuckRuns,
    markOutboxDelivered: outbox.markOutboxDelivered,
    markRunCompensationFailed: runs.markRunCompensationFailed,
    queryStepDatabase: usage.queryStepDatabase,
    recordExternalHeartbeat: waits.recordExternalHeartbeat,
    recordExternalSessionEvent: waits.recordExternalSessionEvent,
    recordUsage: usage.recordUsage,
    recoverExpiredLeases: runControl.recoverExpiredLeases,
    requestCancelRun: runControl.requestCancelRun,
    resumeExternalSession: waits.resumeExternalSession,
    resumeWait: waits.resumeWait,
    consumeSignalAndResumeWait: signals.consumeSignalAndResumeWait,
    retryRun: runs.retryRun,
    scheduleRetry: attempts.scheduleRetry,
    scheduleSleep: attempts.scheduleSleep,
    startRun: runs.startRun,
    wakeParentForChild: waits.wakeParentForChild,
    getRunKV: kv.getRunKV,
    setRunKV: kv.setRunKV,
    deleteRunKV: kv.deleteRunKV,
  }
}

export type WorkflowStore = ReturnType<typeof createWorkflowStore>
