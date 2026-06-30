import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"

import { Pool } from "pg"

import { createMetrics } from "../src/lib/metrics.js"
import { runMigrations } from "../src/lib/migration-runner.js"
import { createHippoTracer } from "../src/lib/tracing.js"
import { defineWorkflow, endStep, taskStep } from "../src/lib/workflow-definition.js"
import { createWorkflowEngine } from "../src/lib/workflow-engine.js"
import { createWorkflowStore } from "../src/lib/workflow-store.js"

type ScenarioResult = {
  workers: number
  runs: number
  durationMs: number
  claims: number
  claimsPerSecond: number
  nullClaimRatio: number
  latencyP50Ms: number
  latencyP95Ms: number
  latencyP99Ms: number
}

const defaultWorkerCounts = [1, 2, 4, 8]
const defaultRunCount = 500
const defaultLeaseMs = 15_000

const benchWorkflow = defineWorkflow({
  name: "bench-throughput",
  version: 1,
  startAt: "work",
  steps: {
    work: taskStep({
      kind: "task",
      next: "done",
      run: () => ({
        patch: {
          ok: true,
        },
      }),
    }),
    done: endStep(),
  },
})

const parseArgs = () => {
  const values = new Map<string, string>()

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=")

    if (!key?.startsWith("--") || value === undefined) {
      continue
    }

    values.set(key.slice(2), value)
  }

  const workerCounts = values.get("workers")
    ? values
        .get("workers")!
        .split(",")
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value > 0)
    : defaultWorkerCounts

  return {
    databaseUrl:
      values.get("database-url") ??
      process.env.HIPPO_PG_TEST_URL ??
      process.env.DATABASE_URL,
    runs: Number.parseInt(values.get("runs") ?? String(defaultRunCount), 10),
    workerCounts,
    leaseMs: Number.parseInt(values.get("lease-ms") ?? String(defaultLeaseMs), 10),
  }
}

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  )

  return sorted[index] ?? 0
}

const createIsolatedDatabase = async (baseUrl: string) => {
  const adminUrl = new URL(baseUrl)
  adminUrl.pathname = "/postgres"

  const databaseName = `hippo_bench_${randomUUID().replaceAll("-", "_")}`
  const adminPool = new Pool({
    connectionString: adminUrl.toString(),
  })

  await adminPool.query(`CREATE DATABASE ${databaseName}`)

  const databaseUrl = new URL(baseUrl)
  databaseUrl.pathname = `/${databaseName}`

  try {
    await runMigrations(databaseUrl.toString())
    return {
      databaseName,
      databaseUrl: databaseUrl.toString(),
      destroy: async () => {
        await adminPool.query(
          `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
           WHERE datname = $1
             AND pid <> pg_backend_pid()`,
          [databaseName]
        )
        await adminPool.query(`DROP DATABASE IF EXISTS ${databaseName}`)
        await adminPool.end()
      },
    }
  } catch (error) {
    await adminPool.query(`DROP DATABASE IF EXISTS ${databaseName}`)
    await adminPool.end()
    throw error
  }
}

const runScenario = async (args: {
  databaseUrl: string
  runs: number
  workers: number
  leaseMs: number
}) => {
  const isolatedDatabase = await createIsolatedDatabase(args.databaseUrl)
  const pool = new Pool({
    connectionString: isolatedDatabase.databaseUrl,
    max: Math.max(10, args.workers * 2),
  })
  const tracer = createHippoTracer()
  const store = createWorkflowStore(pool, { tracer })
  const metrics = createMetrics()
  const engine = createWorkflowEngine({
    definitions: [benchWorkflow],
    metrics,
    store,
    tracer,
  })
  const completedRuns = new Set<string>()
  const runLatenciesMs: number[] = []
  let claims = 0
  let nullClaimsWhileBacklog = 0

  try {
    for (let index = 0; index < args.runs; index += 1) {
      await engine.startRun({
        workflowName: benchWorkflow.name,
        payload: {
          index,
        },
      })
    }

    const startedAt = performance.now()

    await Promise.all(
      Array.from({ length: args.workers }, (_, workerIndex) =>
        (async () => {
          while (completedRuns.size < args.runs) {
            const run = await engine.tick(
              `bench-worker-${String(workerIndex + 1)}`,
              args.leaseMs
            )

            if (!run) {
              if (completedRuns.size < args.runs) {
                nullClaimsWhileBacklog += 1
              }
              continue
            }

            claims += 1

            if (
              run.status === "completed" &&
              run.completedAt &&
              !completedRuns.has(run.id)
            ) {
              completedRuns.add(run.id)
              runLatenciesMs.push(
                run.completedAt.getTime() - run.createdAt.getTime()
              )
            }
          }
        })()
      )
    )

    const durationMs = performance.now() - startedAt

    return {
      workers: args.workers,
      runs: args.runs,
      durationMs,
      claims,
      claimsPerSecond: claims / (durationMs / 1_000),
      nullClaimRatio:
        nullClaimsWhileBacklog === 0
          ? 0
          : nullClaimsWhileBacklog / (claims + nullClaimsWhileBacklog),
      latencyP50Ms: percentile(runLatenciesMs, 0.5),
      latencyP95Ms: percentile(runLatenciesMs, 0.95),
      latencyP99Ms: percentile(runLatenciesMs, 0.99),
    } satisfies ScenarioResult
  } finally {
    await pool.end()
    await isolatedDatabase.destroy()
  }
}

const formatNumber = (value: number, fractionDigits = 1) =>
  value.toFixed(fractionDigits)

const formatResultsAsMarkdown = (results: ScenarioResult[]) => {
  const lines = [
    "| workers | runs | claims/sec | p50 ms | p95 ms | p99 ms | null-claim ratio | duration s |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]

  for (const result of results) {
    lines.push(
      `| ${String(result.workers)} | ${String(result.runs)} | ${formatNumber(
        result.claimsPerSecond
      )} | ${formatNumber(result.latencyP50Ms)} | ${formatNumber(
        result.latencyP95Ms
      )} | ${formatNumber(result.latencyP99Ms)} | ${formatNumber(
        result.nullClaimRatio * 100,
        2
      )}% | ${formatNumber(result.durationMs / 1_000, 2)} |`
    )
  }

  return lines.join("\n")
}

const main = async () => {
  const args = parseArgs()

  if (!args.databaseUrl) {
    throw new Error(
      "Benchmark database URL is required via --database-url, HIPPO_PG_TEST_URL, or DATABASE_URL."
    )
  }

  if (args.runs <= 0) {
    throw new Error(`Expected --runs to be positive, received ${String(args.runs)}`)
  }

  if (args.workerCounts.length === 0) {
    throw new Error("Expected at least one worker count.")
  }

  const results: ScenarioResult[] = []

  for (const workers of args.workerCounts) {
    const result = await runScenario({
      databaseUrl: args.databaseUrl,
      runs: args.runs,
      workers,
      leaseMs: args.leaseMs,
    })
    results.push(result)
  }

  console.log("# Hippo Throughput Benchmark")
  console.log("")
  console.log(
    `database=${new URL(args.databaseUrl).host} runs=${String(args.runs)} workers=${args.workerCounts.join(",")}`
  )
  console.log("")
  console.log(formatResultsAsMarkdown(results))
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
