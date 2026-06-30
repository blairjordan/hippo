import { describe, expect, it, vi } from "vitest"

import { createHippoCli } from "./cli.js"
import type { HippoProcessRole } from "./lib/process-role.js"
import type {
  WorkflowDefinition,
  WorkflowRunRecord,
  WorkflowStepAttemptRecord,
} from "./types/workflow.js"

const testRun: WorkflowRunRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  parentRunId: null,
  parentStepKey: null,
  continuedFromRunId: null,
  branchedFromRunId: null,
  branchedFromAttemptRunId: null,
  branchedFromAttemptId: null,
  supersededByRunId: null,
  definitionName: "demo",
  definitionVersion: 2,
  taskQueue: "priority",
  priority: 10,
  status: "running",
  currentStepKey: "classify",
  input: { email: "hello@example.com" },
  context: { phase: "classify" },
  result: null,
  error: null,
  leaseOwner: "worker-1",
  leaseExpiresAt: new Date("2024-01-01T00:01:00.000Z"),
  cancelRequestedAt: null,
  cancelMode: null,
  availableAt: new Date("2024-01-01T00:00:00.000Z"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:01.000Z"),
  completedAt: null,
  traceContext: null,
}

const testAttempt: WorkflowStepAttemptRecord = {
  id: "attempt-1",
  runId: testRun.id,
  stepKey: "classify",
  kind: "forward",
  stepSeq: 1,
  attempt: 1,
  status: "completed",
  contextBefore: {},
  input: {},
  output: { ok: true },
  error: null,
  startedAt: new Date("2024-01-01T00:00:00.000Z"),
  lastHeartbeatAt: null,
  completedAt: new Date("2024-01-01T00:00:01.000Z"),
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-01T00:00:01.000Z"),
}

const testWorkflowDefinition: WorkflowDefinition = {
  name: "demo",
  version: 2,
  title: "Demo Workflow",
  startAt: "done",
  steps: {
    done: { kind: "end" },
  },
}

const createHarness = () => {
  const stdout: string[] = []
  const stderr: unknown[][] = []
  const sql = {
    end: vi.fn(async () => undefined),
  }
  const store = {
    getRun: vi.fn(async () => testRun),
    getRunAttempts: vi.fn(async () => [testAttempt]),
    listRunsPaginated: vi.fn(async () => [testRun]),
    requestCancelRun: vi.fn(async () => testRun),
  }
  const deps = {
    cwd: () => "/workspace",
    env: {} as Record<string, string | undefined>,
    exit: ((code: number): never => {
      throw new Error(`exit:${String(code)}`)
    }),
    stderr: {
      error: (...args: unknown[]) => {
        stderr.push(args)
      },
    },
    stdout: {
      log: (value?: unknown) => {
        stdout.push(String(value ?? ""))
      },
    },
    runMigrations: vi.fn(async () => undefined),
    loadWorkflowDefinitions: vi.fn(async () => [testWorkflowDefinition]),
    renderWorkflowAsMermaid: vi.fn(() => "flowchart TD"),
    bootstrapStore: vi.fn(async () => ({ sql, store })),
    runProcessRole: vi.fn(
      async (args: { role: HippoProcessRole; workflowsPath: string }) => {
        void args
      }
    ),
  }
  const cli = createHippoCli(deps)

  cli.exitOverride()

  return {
    cli,
    deps,
    sql,
    stderr,
    stdout,
    store,
  }
}

describe("hippo cli", () => {
  it("runs migrations with the provided database URL", async () => {
    const { cli, deps, stdout } = createHarness()

    await cli.parseAsync([
      "node",
      "hippo",
      "migrate",
      "--database-url",
      "postgres://localhost/hippo",
    ])

    expect(deps.runMigrations).toHaveBeenCalledWith("postgres://localhost/hippo")
    expect(stdout).toContain("Migrations applied successfully.")
  })

  it("renders a workflow definition from a workflows module", async () => {
    const { cli, deps, stdout } = createHarness()

    await cli.parseAsync([
      "node",
      "hippo",
      "render",
      "demo",
      "--workflows",
      "src/workflows/index.ts",
    ])

    expect(deps.loadWorkflowDefinitions).toHaveBeenCalledWith(
      new URL("file:///workspace/src/workflows/index.ts")
    )
    expect(deps.renderWorkflowAsMermaid).toHaveBeenCalled()
    expect(stdout).toContain("flowchart TD")
  })

  it("lists workflow definitions", async () => {
    const { cli, stdout } = createHarness()

    await cli.parseAsync(["node", "hippo", "workflows", "ls"])

    expect(stdout).toContain("Registered Workflows:")
    expect(stdout).toContain("- demo (version: 2): Demo Workflow")
  })

  it("lists runs with filters", async () => {
    const { cli, sql, store, stdout } = createHarness()

    await cli.parseAsync([
      "node",
      "hippo",
      "runs",
      "ls",
      "--limit",
      "25",
      "--status",
      "running",
      "--workflow",
      "demo",
      "--search",
      "classify",
    ])

    expect(store.listRunsPaginated).toHaveBeenCalledWith({
      limit: 25,
      search: "classify",
      statuses: ["running"],
      workflowName: "demo",
    })
    expect(sql.end).toHaveBeenCalled()
    expect(stdout.join("\n")).toContain(testRun.id)
  })

  it("shows run details and attempts", async () => {
    const { cli, store, stdout } = createHarness()

    await cli.parseAsync(["node", "hippo", "runs", "show", testRun.id])

    expect(store.getRun).toHaveBeenCalledWith(testRun.id)
    expect(store.getRunAttempts).toHaveBeenCalledWith(testRun.id)
    expect(stdout.join("\n")).toContain("Workflow:           demo (v2)")
    expect(stdout.join("\n")).toContain("Step Attempts:")
  })

  it("cancels runs with the requested mode", async () => {
    const { cli, store, stdout } = createHarness()

    await cli.parseAsync([
      "node",
      "hippo",
      "runs",
      "cancel",
      testRun.id,
      "--mode",
      "hard",
    ])

    expect(store.requestCancelRun).toHaveBeenCalledWith({
      runId: testRun.id,
      mode: "hard",
    })
    expect(stdout).toContain(
      `Cancellation request ('hard') submitted for run ${testRun.id}.`
    )
  })

  it("starts only the API role for serve", async () => {
    const { cli, deps } = createHarness()

    await cli.parseAsync(["node", "hippo", "serve"])

    expect(deps.runProcessRole).toHaveBeenCalledWith({
      role: "serve",
      workflowsPath: "./dist/src/workflows/index.js",
    })
  })

  it("starts only background loops for work", async () => {
    const { cli, deps } = createHarness()

    await cli.parseAsync(["node", "hippo", "work"])

    expect(deps.runProcessRole).toHaveBeenCalledWith({
      role: "work",
      workflowsPath: "./dist/src/workflows/index.js",
    })
  })
})
