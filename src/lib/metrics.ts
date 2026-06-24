import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client"

export const createMetrics = () => {
  const registry = new Registry()

  collectDefaultMetrics({ register: registry })

  const runsStarted = new Counter({
    name: "hippo_runs_started_total",
    help: "Workflow runs started",
    registers: [registry],
    labelNames: ["workflow"] as const,
  })

  const runsCompleted = new Counter({
    name: "hippo_runs_completed_total",
    help: "Workflow runs completed",
    registers: [registry],
    labelNames: ["workflow"] as const,
  })

  const runsFailed = new Counter({
    name: "hippo_runs_failed_total",
    help: "Workflow runs failed",
    registers: [registry],
    labelNames: ["workflow", "step"] as const,
  })

  const stepAttempts = new Counter({
    name: "hippo_step_attempts_total",
    help: "Workflow step attempts",
    registers: [registry],
    labelNames: ["workflow", "step", "status"] as const,
  })

  const retries = new Counter({
    name: "hippo_step_retries_total",
    help: "Workflow step retries scheduled",
    registers: [registry],
    labelNames: ["workflow", "step"] as const,
  })

  const waitOpens = new Gauge({
    name: "hippo_waits_open",
    help: "Open callback waits",
    registers: [registry],
  })

  const claims = new Counter({
    name: "hippo_claims_total",
    help: "Claimed runnable workflow runs",
    registers: [registry],
  })

  const leaseReclaims = new Counter({
    name: "hippo_lease_reclaims_total",
    help: "Expired workflow leases reclaimed by recovery",
    registers: [registry],
  })

  const recoveryActions = new Counter({
    name: "hippo_recovery_actions_total",
    help: "Recovery loop actions by type",
    registers: [registry],
    labelNames: ["action"] as const,
  })

  const runDurationSeconds = new Histogram({
    name: "hippo_run_duration_seconds",
    help: "End-to-end workflow runtime by final status",
    registers: [registry],
    labelNames: ["workflow", "status"] as const,
    buckets: [0.1, 0.5, 1, 5, 15, 30, 60, 300, 900, 3600],
  })

  return {
    registry,
    runsStarted,
    runsCompleted,
    runsFailed,
    stepAttempts,
    retries,
    waitOpens,
    claims,
    leaseReclaims,
    recoveryActions,
    runDurationSeconds,
  }
}

export type HippoMetrics = ReturnType<typeof createMetrics>
