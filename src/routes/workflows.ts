import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
} from "fastify"
import { z } from "zod"

import { renderWorkflowAsMermaid } from "../lib/workflow-definition.js"
import type { HippoAuth } from "../lib/auth.js"
import type { HippoMetrics } from "../lib/metrics.js"
import type { WorkflowNotification } from "../lib/notifier.js"
import { runRecoveryPass } from "../lib/recovery.js"
import { computeNextScheduleFireAt } from "../lib/scheduler.js"
import type { WorkflowEngine } from "../lib/workflow-engine.js"
import type { WorkflowStore } from "../lib/workflow-store.js"
import type { JsonObject, JsonValue } from "../types/json.js"

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
)

const startRunBodySchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema
)

const resumeBodySchema = z.object({
  payload: jsonValueSchema.optional(),
})

const operatorListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
})

const stuckRunsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  olderThanMs: z.coerce.number().int().positive().default(60_000),
})

const runStreamQuerySchema = z.object({
  afterEventId: z.coerce.number().int().nonnegative().default(0),
})

const runIdParamsSchema = z.object({
  runId: z.uuid(),
})

const workflowNameParamsSchema = z.object({
  workflowName: z.string().min(1),
})

const correlationKeyParamsSchema = z.object({
  correlationKey: z.string().min(1),
})

const signalParamsSchema = z.object({
  runId: z.uuid(),
  signalName: z.string().min(1),
})

const cancelRunBodySchema = z.object({
  mode: z.enum(["graceful", "hard"]).default("graceful"),
  reason: z.string().min(1).max(1_000).optional(),
})

const createScheduleBodySchema = z.object({
  workflowName: z.string().min(1),
  cronExpression: z.string().min(1),
  payload: startRunBodySchema.optional(),
})

const reconcileBodySchema = z.object({
  limit: z.coerce.number().int().positive().max(1_000).default(100),
})

const dashboardRunPath = (runId: string) => `/dashboard/runs/${runId}`

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const formatDateTime = (value: Date | null) =>
  value ? value.toISOString().replace("T", " ").replace("Z", " UTC") : "—"

const formatJson = (value: JsonValue) =>
  escapeHtml(JSON.stringify(value, null, 2) ?? "null")

const statusToneByRun = {
  queued: "tone-queued",
  running: "tone-running",
  waiting: "tone-waiting",
  completed: "tone-completed",
  failed: "tone-failed",
  canceled: "tone-canceled",
} as const

const renderDashboardDocument = (args: {
  activeRunsHtml: string
  failedRunsHtml: string
  workflowsHtml: string
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hippo Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --page: #f7f2e8;
        --panel: rgba(255, 252, 247, 0.92);
        --line: #d8c9ae;
        --ink: #1f1b16;
        --muted: #665b4d;
        --accent: #1f6f5f;
        --accent-soft: #d7ece7;
        --warn: #a94f1d;
        --danger: #8c1d18;
        --shadow: 0 18px 40px rgba(77, 57, 28, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(31, 111, 95, 0.16), transparent 34%),
          linear-gradient(160deg, #fbf6ec 0%, var(--page) 48%, #efe2cb 100%);
      }

      main {
        width: min(1180px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }

      h1, h2, h3 { margin: 0; font-weight: 700; }
      p { margin: 0; color: var(--muted); }
      a { color: inherit; }

      .hero {
        display: grid;
        gap: 12px;
        margin-bottom: 24px;
        padding: 28px;
        border: 1px solid rgba(31, 111, 95, 0.15);
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(231,243,238,0.95));
        box-shadow: var(--shadow);
      }

      .hero h1 { font-size: clamp(2rem, 4vw, 3.4rem); letter-spacing: -0.04em; }
      .hero p { max-width: 64ch; font-size: 1rem; line-height: 1.5; }

      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      .panel {
        border: 1px solid var(--line);
        border-radius: 20px;
        background: var(--panel);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 20px 12px;
      }

      .panel-body { padding: 0 20px 20px; }

      .stack { display: grid; gap: 12px; }

      .run-card, .workflow-card {
        display: grid;
        gap: 8px;
        padding: 14px;
        border: 1px solid rgba(216, 201, 174, 0.9);
        border-radius: 16px;
        background: rgba(255,255,255,0.72);
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .meta {
        font-family: "SFMono-Regular", "Menlo", monospace;
        font-size: 0.82rem;
        color: var(--muted);
      }

      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .tone-queued, .tone-waiting { background: #f4ead7; color: #7a5710; }
      .tone-running { background: var(--accent-soft); color: var(--accent); }
      .tone-completed { background: #dff1dd; color: #25653b; }
      .tone-failed { background: #f8ddda; color: var(--danger); }
      .tone-canceled { background: #ebe3e3; color: #5f4750; }

      .action {
        text-decoration: none;
        font-weight: 700;
      }

      .empty {
        padding: 14px;
        border: 1px dashed var(--line);
        border-radius: 16px;
        color: var(--muted);
      }

      @media (max-width: 700px) {
        main { width: min(100vw - 20px, 1180px); padding-top: 20px; }
        .hero { padding: 22px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Hippo dashboard</h1>
        <p>Run state, retry pressure, and workflow topology in one place. This skeleton uses the existing operator APIs plus SSE for live event tails.</p>
      </section>
      <section class="grid">
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Active runs</h2>
              <p>Queued, running, and waiting work.</p>
            </div>
          </div>
          <div class="panel-body stack">${args.activeRunsHtml}</div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <div>
              <h2>Failed runs</h2>
              <p>Terminal failures that may need retry or inspection.</p>
            </div>
          </div>
          <div class="panel-body stack">${args.failedRunsHtml}</div>
        </article>
      </section>
      <section class="panel" style="margin-top: 18px;">
        <div class="panel-header">
          <div>
            <h2>Workflow definitions</h2>
            <p>Registered workflows with static Mermaid renders.</p>
          </div>
        </div>
        <div class="panel-body stack">${args.workflowsHtml}</div>
      </section>
    </main>
  </body>
</html>`

const renderDashboardRun = (run: {
  id: string
  definitionName: string
  status: keyof typeof statusToneByRun
  currentStepKey: string | null
  availableAt: Date
  updatedAt: Date
}) => `<article class="run-card">
  <div class="row">
    <a class="action" href="${dashboardRunPath(run.id)}">${escapeHtml(run.definitionName)}</a>
    <span class="pill ${statusToneByRun[run.status]}">${escapeHtml(run.status)}</span>
  </div>
  <div class="meta">${escapeHtml(run.id)}</div>
  <div class="meta">step ${escapeHtml(run.currentStepKey ?? "—")} · available ${escapeHtml(formatDateTime(run.availableAt))}</div>
  <div class="meta">updated ${escapeHtml(formatDateTime(run.updatedAt))}</div>
</article>`

const renderWorkflowCard = (args: {
  mermaid: string
  workflowName: string
  workflowTitle?: string
}) => `<article class="workflow-card">
  <div class="row">
    <div>
      <h3>${escapeHtml(args.workflowTitle ?? args.workflowName)}</h3>
      <div class="meta">${escapeHtml(args.workflowName)}</div>
    </div>
    <a class="action" href="/v1/workflows/${encodeURIComponent(args.workflowName)}/render">Mermaid</a>
  </div>
  <pre class="meta" style="margin: 0; white-space: pre-wrap;">${escapeHtml(args.mermaid)}</pre>
</article>`

const renderRunDetailDocument = (args: {
  attempts: string
  events: string
  lastEventId: number
  run: Awaited<ReturnType<WorkflowStore["getRun"]>>
  workflowMermaid: string
}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Run ${escapeHtml(args.run?.id ?? "")}</title>
    <style>
      :root {
        color-scheme: light;
        --page: #f6f2ea;
        --panel: rgba(255, 252, 247, 0.95);
        --line: #d7cbb4;
        --ink: #201912;
        --muted: #6a5b48;
        --accent: #195d82;
        --shadow: 0 18px 40px rgba(72, 55, 26, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          linear-gradient(180deg, rgba(25, 93, 130, 0.08), transparent 30%),
          linear-gradient(135deg, #fcf7ee 0%, var(--page) 60%, #efe5d2 100%);
      }
      main { width: min(1180px, calc(100vw - 24px)); margin: 0 auto; padding: 24px 0 48px; display: grid; gap: 18px; }
      a { color: inherit; }
      .hero, .panel {
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .hero { padding: 24px; display: grid; gap: 10px; }
      .hero h1 { margin: 0; font-size: clamp(1.8rem, 3vw, 2.6rem); letter-spacing: -0.04em; }
      .hero p, .meta { margin: 0; color: var(--muted); }
      .grid { display: grid; gap: 18px; grid-template-columns: 1.2fr 0.8fr; }
      .panel { overflow: hidden; }
      .panel header { padding: 16px 18px 12px; border-bottom: 1px solid rgba(215, 203, 180, 0.8); }
      .panel header h2 { margin: 0; }
      .panel section { padding: 18px; }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "SFMono-Regular", "Menlo", monospace;
        font-size: 0.84rem;
      }
      .card-list { display: grid; gap: 12px; }
      .entry { padding: 12px; border: 1px solid rgba(215, 203, 180, 0.85); border-radius: 16px; background: rgba(255,255,255,0.74); }
      .entry strong { display: block; margin-bottom: 6px; }
      .entry time { color: var(--muted); font-size: 0.82rem; }
      .summary { display: grid; gap: 10px; }
      .summary-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .summary-row span:last-child { font-family: "SFMono-Regular", "Menlo", monospace; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <a href="/dashboard">← Back to dashboard</a>
        <h1>${escapeHtml(args.run?.definitionName ?? "Run")} · ${escapeHtml(args.run?.id ?? "")}</h1>
        <p>Live event tail is powered by <code>GET /v1/runs/:runId/stream</code>. The pane below appends new workflow events without a page reload.</p>
      </section>
      <section class="grid">
        <article class="panel">
          <header><h2>Run detail</h2></header>
          <section class="summary">
            <div class="summary-row"><span>Status</span><span>${escapeHtml(args.run?.status ?? "missing")}</span></div>
            <div class="summary-row"><span>Current step</span><span>${escapeHtml(args.run?.currentStepKey ?? "—")}</span></div>
            <div class="summary-row"><span>Created</span><span>${escapeHtml(formatDateTime(args.run?.createdAt ?? null))}</span></div>
            <div class="summary-row"><span>Updated</span><span>${escapeHtml(formatDateTime(args.run?.updatedAt ?? null))}</span></div>
            <div class="summary-row"><span>Completed</span><span>${escapeHtml(formatDateTime(args.run?.completedAt ?? null))}</span></div>
          </section>
          <section>
            <h2 style="margin: 0 0 12px;">Context</h2>
            <pre>${formatJson(args.run?.context ?? {})}</pre>
          </section>
          <section>
            <h2 style="margin: 0 0 12px;">Workflow map</h2>
            <pre>${escapeHtml(args.workflowMermaid)}</pre>
          </section>
        </article>
        <article class="panel">
          <header><h2>Attempts</h2></header>
          <section class="card-list">${args.attempts}</section>
        </article>
      </section>
      <article class="panel">
        <header><h2>Live events</h2></header>
        <section>
          <div id="event-list" class="card-list">${args.events}</div>
        </section>
      </article>
    </main>
    <script>
      const eventList = document.getElementById("event-list")
      const source = new EventSource("/v1/runs/${args.run?.id ?? ""}/stream?afterEventId=${String(args.lastEventId)}")
      source.onmessage = (event) => {
        const payload = JSON.parse(event.data)
        const item = document.createElement("article")
        item.className = "entry"
        const title = document.createElement("strong")
        title.textContent = payload.eventType
        const time = document.createElement("time")
        time.textContent = payload.createdAt
        const pre = document.createElement("pre")
        pre.textContent = JSON.stringify(payload.payload, null, 2)
        item.appendChild(title)
        item.appendChild(time)
        item.appendChild(pre)
        eventList?.appendChild(item)
      }
      source.onerror = () => {
        source.close()
      }
    </script>
  </body>
</html>`

const renderAttemptCard = (attempt: {
  attempt: number
  completedAt: Date | null
  error: JsonValue | null
  output: JsonValue | null
  startedAt: Date
  status: string
  stepKey: string
}) => `<article class="entry">
  <strong>${escapeHtml(attempt.stepKey)} · attempt ${String(attempt.attempt)}</strong>
  <time>${escapeHtml(formatDateTime(attempt.startedAt))} → ${escapeHtml(formatDateTime(attempt.completedAt))}</time>
  <pre>${formatJson({
    status: attempt.status,
    output: attempt.output,
    error: attempt.error,
  })}</pre>
</article>`

const renderEventCard = (event: {
  createdAt: Date
  eventType: string
  payload: JsonValue
}) => `<article class="entry">
  <strong>${escapeHtml(event.eventType)}</strong>
  <time>${escapeHtml(formatDateTime(event.createdAt))}</time>
  <pre>${formatJson(event.payload)}</pre>
</article>`

const requireApiAuth = (
  app: FastifyInstance,
  request: FastifyRequest,
  auth: HippoAuth
) => {
  if (!auth.verifyApiRequest(request)) {
    throw app.httpErrors.unauthorized()
  }
}

const requireCallbackAuth = (
  app: FastifyInstance,
  request: FastifyRequest,
  body: JsonValue,
  auth: HippoAuth
) => {
  if (!auth.verifyCallbackRequest(request, body)) {
    throw app.httpErrors.unauthorized()
  }
}

const getExistingRun = async (
  app: FastifyInstance,
  store: WorkflowStore,
  runId: string
) => {
  const run = await store.getRun(runId)

  if (!run) {
    throw app.httpErrors.notFound(`Run "${runId}" not found`)
  }

  return run
}

const propagateCancellation = async (args: {
  mode: "graceful" | "hard"
  reason: string | undefined
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await args.store.requestCancelRun({
      runId: childRun.id,
      mode: args.mode,
      ...(args.reason === undefined ? {} : { reason: args.reason }),
    })

    await propagateCancellation({
      mode: args.mode,
      reason: args.reason,
      runId: childRun.id,
      store: args.store,
    })
  }
}

export const createWorkflowRoutes = (args: {
  auth: HippoAuth
  engine: WorkflowEngine
  listenForNotifications?: (
    onNotification: (notification: WorkflowNotification) => void
  ) => Promise<() => Promise<void>>
  metrics: HippoMetrics
  store: WorkflowStore
}): FastifyPluginAsync => async (app) => {
  app.get("/dashboard", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const [activeRuns, failedRuns] = await Promise.all([
      args.store.listActiveRuns(25),
      args.store.listFailedRuns(25),
    ])
    const workflows = args.engine.listWorkflows()
    const document = renderDashboardDocument({
      activeRunsHtml:
        activeRuns.length > 0
          ? activeRuns.map(renderDashboardRun).join("")
          : '<div class="empty">No active runs.</div>',
      failedRunsHtml:
        failedRuns.length > 0
          ? failedRuns.map(renderDashboardRun).join("")
          : '<div class="empty">No failed runs.</div>',
      workflowsHtml:
        workflows.length > 0
          ? workflows
              .map((workflow) =>
                renderWorkflowCard({
                  mermaid: renderWorkflowAsMermaid(workflow),
                  workflowName: workflow.name,
                  ...(workflow.title === undefined
                    ? {}
                    : { workflowTitle: workflow.title }),
                })
              )
              .join("")
          : '<div class="empty">No workflows are registered.</div>',
    })

    reply.header("content-type", "text/html; charset=utf-8")
    return document
  })

  app.get("/dashboard/runs/:runId", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const run = await getExistingRun(app, args.store, params.runId)
    const [events, attempts] = await Promise.all([
      args.store.getRunEvents(run.id),
      args.store.getRunAttempts(run.id),
    ])
    const workflow = args.engine.getWorkflow(run.definitionName)
    const document = renderRunDetailDocument({
      attempts:
        attempts.length > 0
          ? attempts.map(renderAttemptCard).join("")
          : '<div class="entry">No attempts recorded yet.</div>',
      events:
        events.length > 0
          ? events.map(renderEventCard).join("")
          : '<div class="entry">No workflow events recorded yet.</div>',
      lastEventId: events.at(-1)?.id ?? 0,
      run,
      workflowMermaid: renderWorkflowAsMermaid(workflow),
    })

    reply.header("content-type", "text/html; charset=utf-8")
    return document
  })

  app.post("/v1/workflows/:workflowName/runs", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = workflowNameParamsSchema.parse(request.params)
    const payload = startRunBodySchema.parse(request.body ?? {})

    if (!args.engine.hasWorkflow(params.workflowName)) {
      throw app.httpErrors.notFound(
        `Workflow "${params.workflowName}" is not registered`
      )
    }

    const run = await args.engine.startRun({
      workflowName: params.workflowName,
      payload,
    })

    reply.code(202)
    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.get("/v1/operators/runs/active", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = operatorListQuerySchema.parse(request.query)
    return {
      runs: await args.store.listActiveRuns(query.limit),
    }
  })

  app.get("/v1/operators/runs/failed", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = operatorListQuerySchema.parse(request.query)
    return {
      runs: await args.store.listFailedRuns(query.limit),
    }
  })

  app.get("/v1/operators/runs/stuck", async (request) => {
    requireApiAuth(app, request, args.auth)

    const query = stuckRunsQuerySchema.parse(request.query)
    return {
      runs: await args.store.listStuckRuns(query),
    }
  })

  app.post("/v1/operators/runs/:runId/cancel", async (request) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const body = cancelRunBodySchema.parse(request.body ?? {})
    const existingRun = await getExistingRun(app, args.store, params.runId)

    if (
      existingRun.status === "completed" ||
      existingRun.status === "canceled"
    ) {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" cannot be canceled from status "${existingRun.status}"`
      )
    }

    const run = await args.store.requestCancelRun({
      runId: params.runId,
      mode: body.mode,
      ...(body.reason === undefined ? {} : { reason: body.reason }),
    })

    if (!run) {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" could not be canceled`
      )
    }

    await propagateCancellation({
      mode: body.mode,
      reason: body.reason,
      runId: run.id,
      store: args.store,
    })

    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.post("/v1/operators/runs/:runId/terminate", async (request) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const body = z
      .object({
        reason: z.string().min(1).max(1_000).optional(),
      })
      .parse(request.body ?? {})

    const run = await args.store.requestCancelRun({
      runId: params.runId,
      mode: "hard",
      ...(body.reason === undefined ? {} : { reason: body.reason }),
    })

    if (!run) {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" could not be terminated`
      )
    }

    await propagateCancellation({
      mode: "hard",
      reason: body.reason,
      runId: run.id,
      store: args.store,
    })

    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.post("/v1/operators/runs/:runId/retry", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const existingRun = await getExistingRun(app, args.store, params.runId)

    if (existingRun.status !== "failed") {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" cannot be retried from status "${existingRun.status}"`
      )
    }

    const run = await args.store.retryRun(params.runId)

    if (!run) {
      throw app.httpErrors.conflict(
        `Run "${params.runId}" could not be retried`
      )
    }

    reply.code(202)
    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
    }
  })

  app.post("/v1/operators/recovery/reconcile", async (request) => {
    requireApiAuth(app, request, args.auth)

    const body = reconcileBodySchema.parse(request.body ?? {})
    const reclaimed = await runRecoveryPass({
      limit: body.limit,
      metrics: args.metrics,
      store: args.store,
    })

    return {
      reclaimed,
    }
  })

  app.post("/v1/operators/schedules", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const body = createScheduleBodySchema.parse(request.body ?? {})

    if (!args.engine.hasWorkflow(body.workflowName)) {
      throw app.httpErrors.notFound(
        `Workflow "${body.workflowName}" is not registered`
      )
    }

    const schedule = await args.store.createSchedule({
      workflowName: body.workflowName,
      cronExpression: body.cronExpression,
      payload: body.payload ?? {},
      nextFireAt: computeNextScheduleFireAt({
        cronExpression: body.cronExpression,
      }),
    })

    reply.code(201)
    return {
      schedule,
    }
  })

  app.post("/v1/runs/:runId/signals/:signalName", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = signalParamsSchema.parse(request.params)
    const body = z
      .object({
        payload: jsonValueSchema.optional(),
      })
      .parse(request.body ?? {})
    const runId = await args.store.createSignal({
      runId: params.runId,
      signalName: params.signalName,
      payload: body.payload ?? null,
    })

    if (!runId) {
      throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
    }

    reply.code(202)
    return {
      runId,
      signalName: params.signalName,
    }
  })

  app.get("/v1/runs/:runId", async (request) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const run = await args.store.getRun(params.runId)

    if (!run) {
      throw app.httpErrors.notFound(`Run "${params.runId}" not found`)
    }

    const [events, attempts] = await Promise.all([
      args.store.getRunEvents(run.id),
      args.store.getRunAttempts(run.id),
    ])

    return {
      run,
      attempts,
      events,
    }
  })

  app.get("/v1/runs/:runId/stream", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const query = runStreamQuerySchema.parse(request.query)
    await getExistingRun(app, args.store, params.runId)

    reply.hijack()
    reply.raw.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    })

    let active = true
    let lastEventId = Math.max(
      Number(request.headers["last-event-id"] ?? 0) || 0,
      query.afterEventId
    )
    let sending = false

    const sendPendingEvents = async () => {
      if (!active || sending) {
        return
      }

      sending = true

      try {
        const events = await args.store.getRunEvents(params.runId)

        for (const event of events) {
          if (event.id <= lastEventId) {
            continue
          }

          lastEventId = event.id
          reply.raw.write(`id: ${String(event.id)}\n`)
          reply.raw.write(`data: ${JSON.stringify({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })}\n\n`)
        }
      } finally {
        sending = false
      }
    }

    const heartbeat = setInterval(() => {
      if (active) {
        reply.raw.write(": keepalive\n\n")
      }
    }, 15_000)
    const poller = setInterval(() => {
      void sendPendingEvents()
    }, 5_000)
    let stopListening: (() => Promise<void>) | null = null

    if (args.listenForNotifications) {
      try {
        stopListening = await args.listenForNotifications((notification) => {
          if (
            notification.kind === "run_event" &&
            notification.runId === params.runId
          ) {
            void sendPendingEvents()
          }
        })
      } catch {
        stopListening = null
      }
    }

    await sendPendingEvents()

    reply.raw.on("close", () => {
      active = false
      clearInterval(heartbeat)
      clearInterval(poller)
      void stopListening?.()
    })
  })

  app.post("/v1/waits/:correlationKey/resume", async (request, reply) => {
    const rawBody = (request.body ?? {}) as JsonValue
    requireCallbackAuth(app, request, rawBody, args.auth)

    const params = correlationKeyParamsSchema.parse(request.params)
    const body = resumeBodySchema.parse(request.body ?? {})
    const run = await args.engine.resumeWait(
      body.payload === undefined
        ? { correlationKey: params.correlationKey }
        : { correlationKey: params.correlationKey, payload: body.payload }
    )

    if (run.status === "missing") {
      throw app.httpErrors.notFound(
        `Open wait "${params.correlationKey}" not found`
      )
    }

    reply.code(run.status === "duplicate" ? 200 : 202)
    return {
      outcome: run.status,
      runId: run.run?.id ?? null,
      status: run.run?.status ?? null,
      currentStepKey: run.run?.currentStepKey ?? null,
    }
  })

  app.get("/v1/workflows/:workflowName/render", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = workflowNameParamsSchema.parse(request.params)

    if (!args.engine.hasWorkflow(params.workflowName)) {
      throw app.httpErrors.notFound(
        `Workflow "${params.workflowName}" is not registered`
      )
    }

    const workflow = args.engine.getWorkflow(params.workflowName)
    const document = renderWorkflowAsMermaid(workflow)

    reply.header("content-type", "text/plain; charset=utf-8")
    return document
  })
}
