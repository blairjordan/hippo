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

const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema)

const startRunBodySchema = z.object({
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
})

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

const runContextQuerySchema = z.object({
  keys: z.string().min(1).optional(),
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
  payload: jsonObjectSchema.default({}),
  taskQueue: z.string().min(1).default("default"),
  priority: z.coerce.number().int().default(0),
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

const projectContextValue = (
  source: JsonObject,
  dottedKey: string
): JsonValue | undefined => {
  const parts = dottedKey.split(".").filter((part) => part.length > 0)
  let current: JsonValue | undefined = source

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined
    }

    current = current[part]
  }

  return current
}

const projectRunContext = (source: JsonObject, keys: string[]) => {
  if (keys.length === 0) {
    return source
  }

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = projectContextValue(source, key)
      return value === undefined ? [] : [[key, value]]
    })
  )
}

const statusToneByRun = {
  queued: "tone-queued",
  running: "tone-running",
  waiting: "tone-waiting",
  completed: "tone-completed",
  failed: "tone-failed",
  compensation_failed: "tone-failed",
  canceled: "tone-canceled",
} as const

const renderMermaidMount = (graph: string) =>
  `<div class="mermaid" data-graph="${escapeHtml(graph)}"></div>`

const renderMermaidBootstrap = () => `<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"

  const storageKey = "hippo-dashboard-theme"
  const root = document.documentElement
  const getPreferredTheme = () => {
    const storedTheme = window.localStorage.getItem(storageKey)

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }

  const applyTheme = (theme) => {
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
    window.localStorage.setItem(storageKey, theme)
    const toggle = document.querySelector("[data-theme-toggle]")

    if (toggle instanceof HTMLButtonElement) {
      toggle.dataset.theme = theme
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      )
      toggle.textContent = theme === "dark" ? "Light" : "Dark"
    }
  }

  const renderFallback = () => {
    for (const node of document.querySelectorAll(".mermaid")) {
      const graph = node.getAttribute("data-graph")

      if (!graph) {
        continue
      }

      node.innerHTML = '<pre class="mermaid-fallback"></pre>'
      const pre = node.querySelector("pre")

      if (pre) {
        pre.textContent = graph
      }
    }
  }

  const renderMermaids = async () => {
    const isDark = root.classList.contains("dark")

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: {
        primaryColor: isDark ? "#0f172a" : "#ffffff",
        primaryTextColor: isDark ? "#e2e8f0" : "#0f172a",
        primaryBorderColor: isDark ? "#475569" : "#cbd5e1",
        lineColor: isDark ? "#64748b" : "#94a3b8",
        secondaryColor: isDark ? "#111827" : "#f8fafc",
        tertiaryColor: isDark ? "#020617" : "#f8fafc",
        background: "transparent",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      flowchart: {
        curve: "linear",
        useMaxWidth: true,
        htmlLabels: true,
      },
    })

    for (const node of document.querySelectorAll(".mermaid")) {
      const graph = node.getAttribute("data-graph")

      if (!graph) {
        continue
      }

      node.removeAttribute("data-processed")
      node.textContent = graph
    }

    try {
      await mermaid.run({
        querySelector: ".mermaid",
      })
    } catch (error) {
      renderFallback()
      console.error(error)
    }
  }

  applyTheme(getPreferredTheme())
  await renderMermaids()

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", async () => {
    const nextTheme = root.classList.contains("dark") ? "light" : "dark"
    applyTheme(nextTheme)
    await renderMermaids()
  })
</script>`

const shadcnThemeTokens = `
      :root {
        color-scheme: light;
        --background: 0 0% 100%;
        --foreground: 240 10% 3.9%;
        --card: 0 0% 100%;
        --card-foreground: 240 10% 3.9%;
        --popover: 0 0% 100%;
        --popover-foreground: 240 10% 3.9%;
        --primary: 240 5.9% 10%;
        --primary-foreground: 0 0% 98%;
        --secondary: 240 4.8% 95.9%;
        --secondary-foreground: 240 5.9% 10%;
        --muted: 240 4.8% 95.9%;
        --muted-foreground: 240 3.8% 46.1%;
        --accent: 240 4.8% 95.9%;
        --accent-foreground: 240 5.9% 10%;
        --destructive: 0 84.2% 60.2%;
        --destructive-foreground: 0 0% 98%;
        --warning: 38 92% 50%;
        --success: 142 71% 36%;
        --info: 217 91% 60%;
        --border: 240 5.9% 90%;
        --input: 240 5.9% 90%;
        --ring: 240 10% 3.9%;
        --radius: 0.5rem;
      }

      :root.dark {
        color-scheme: dark;
        --background: 240 10% 3.9%;
        --foreground: 0 0% 98%;
        --card: 240 10% 3.9%;
        --card-foreground: 0 0% 98%;
        --popover: 240 10% 3.9%;
        --popover-foreground: 0 0% 98%;
        --primary: 0 0% 98%;
        --primary-foreground: 240 5.9% 10%;
        --secondary: 240 3.7% 15.9%;
        --secondary-foreground: 0 0% 98%;
        --muted: 240 3.7% 15.9%;
        --muted-foreground: 240 5% 64.9%;
        --accent: 240 3.7% 15.9%;
        --accent-foreground: 0 0% 98%;
        --destructive: 0 62.8% 30.6%;
        --destructive-foreground: 0 0% 98%;
        --warning: 38 92% 60%;
        --success: 142 71% 45%;
        --info: 217 91% 70%;
        --border: 240 3.7% 15.9%;
        --input: 240 3.7% 15.9%;
        --ring: 240 4.9% 83.9%;
      }`

const shadcnBaseStyles = `
      *, *::before, *::after { box-sizing: border-box; border-color: hsl(var(--border)); }

      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-feature-settings: "rlig" 1, "calt" 1;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        -webkit-font-smoothing: antialiased;
        line-height: 1.5;
      }

      h1, h2, h3, h4, p { margin: 0; }
      a { color: inherit; text-decoration: none; }
      code { font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace; font-size: 0.85em; }

      .container {
        width: 100%;
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
      }

      .site-header {
        position: sticky;
        top: 0;
        z-index: 40;
        background: hsl(var(--background) / 0.95);
        border-bottom: 1px solid hsl(var(--border));
        backdrop-filter: blur(8px);
      }

      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        height: 3.5rem;
      }

      .brand-row {
        display: flex;
        align-items: center;
        gap: 1.5rem;
      }

      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        font-size: 0.95rem;
        letter-spacing: -0.01em;
      }

      .brand-mark {
        display: inline-flex;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 0.375rem;
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 700;
      }

      .nav {
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }

      .nav-item {
        font-size: 0.875rem;
        font-weight: 500;
        color: hsl(var(--muted-foreground));
        transition: color 0.15s;
      }
      .nav-item:hover { color: hsl(var(--foreground)); }
      .nav-item-active { color: hsl(var(--foreground)); }

      .header-actions { display: flex; align-items: center; gap: 0.5rem; }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
        font-size: 0.875rem;
        font-weight: 500;
        border-radius: calc(var(--radius) - 2px);
        transition: background 0.15s, color 0.15s, border-color 0.15s;
        cursor: pointer;
        border: 1px solid transparent;
        font-family: inherit;
        text-decoration: none;
      }
      .btn-sm { height: 2.25rem; padding: 0 0.75rem; }
      .btn-primary {
        background: hsl(var(--primary));
        color: hsl(var(--primary-foreground));
      }
      .btn-primary:hover { background: hsl(var(--primary) / 0.9); }
      .btn-outline {
        background: hsl(var(--background));
        border-color: hsl(var(--input));
        color: hsl(var(--foreground));
      }
      .btn-outline:hover { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }

      .card {
        background: hsl(var(--card));
        color: hsl(var(--card-foreground));
        border: 1px solid hsl(var(--border));
        border-radius: var(--radius);
        box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
      }

      .card-header {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 1.5rem 1.5rem 0;
      }
      .card-header-row {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 0.5rem;
        gap: 0.5rem;
      }
      .card-title {
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.2;
      }
      .card-title-sm {
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1;
      }
      .card-description {
        font-size: 0.875rem;
        color: hsl(var(--muted-foreground));
      }
      .card-content { padding: 1.5rem; }
      .card-header + .card-content { padding-top: 1rem; }

      .icon { width: 1rem; height: 1rem; color: hsl(var(--muted-foreground)); flex-shrink: 0; }

      .badge {
        display: inline-flex;
        align-items: center;
        border-radius: calc(var(--radius) - 2px);
        padding: 0.125rem 0.5rem;
        border: 1px solid transparent;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1.25;
        text-transform: capitalize;
      }
      .tone-queued, .tone-waiting {
        background: hsl(var(--warning) / 0.12);
        border-color: hsl(var(--warning) / 0.3);
        color: hsl(var(--warning));
      }
      .tone-running {
        background: hsl(var(--info) / 0.12);
        border-color: hsl(var(--info) / 0.3);
        color: hsl(var(--info));
      }
      .tone-completed {
        background: hsl(var(--success) / 0.12);
        border-color: hsl(var(--success) / 0.3);
        color: hsl(var(--success));
      }
      .tone-failed {
        background: hsl(var(--destructive) / 0.12);
        border-color: hsl(var(--destructive) / 0.3);
        color: hsl(var(--destructive));
      }
      .tone-canceled {
        background: hsl(var(--muted));
        border-color: hsl(var(--border));
        color: hsl(var(--muted-foreground));
      }

      .meta {
        font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .stack { display: grid; gap: 0.75rem; }`

const renderDashboardDocument = (args: {
  activeRunsHtml: string
  failedRunsHtml: string
  workflowsHtml: string
}) => {
  const activeRunCount = (args.activeRunsHtml.match(/run-card/g) ?? []).length
  const failedRunCount = (args.failedRunsHtml.match(/run-card/g) ?? []).length
  const workflowCount = (args.workflowsHtml.match(/workflow-card/g) ?? []).length

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hippo dashboard</title>
    <style>${shadcnThemeTokens}${shadcnBaseStyles}
      .main {
        padding-top: 1.5rem;
        padding-bottom: 4rem;
        display: grid;
        gap: 1.5rem;
      }

      .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-title h1 {
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1.1;
      }
      .page-title p {
        font-size: 0.875rem;
        color: hsl(var(--muted-foreground));
        margin-top: 0.375rem;
      }

      .stat-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .stat-value {
        font-size: 1.875rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1;
      }
      .stat-foot {
        margin-top: 0.375rem;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
      }

      .two-col {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }

      .run-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--card));
        transition: background 0.15s;
      }
      .run-card:hover { background: hsl(var(--muted) / 0.5); }
      .run-title { font-size: 0.9rem; font-weight: 600; color: hsl(var(--foreground)); }
      .run-title:hover { text-decoration: underline; text-underline-offset: 3px; }

      .empty {
        padding: 2rem 1rem;
        border: 1px dashed hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        color: hsl(var(--muted-foreground));
        font-size: 0.875rem;
        text-align: center;
      }

      .workflow-card {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 280px) minmax(0, 1fr);
        align-items: start;
        padding: 1rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--card));
      }
      .workflow-info { display: grid; gap: 0.5rem; }
      .workflow-info h3 { font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; }
      .workflow-info p { font-size: 0.8125rem; color: hsl(var(--muted-foreground)); }
      .workflow-diagram {
        min-height: 180px;
        padding: 0.75rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--muted) / 0.4);
        overflow: auto;
      }

      .link-action { font-size: 0.8125rem; font-weight: 500; color: hsl(var(--muted-foreground)); }
      .link-action:hover { color: hsl(var(--foreground)); }

      .mermaid { min-width: 480px; }
      .mermaid-fallback {
        white-space: pre-wrap;
        font-family: ui-monospace, "SFMono-Regular", monospace;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
      }

      @media (max-width: 900px) {
        .container { padding: 0 1rem; }
        .two-col { grid-template-columns: 1fr; }
        .workflow-card { grid-template-columns: 1fr; }
        .nav { display: none; }
        .mermaid { min-width: 360px; }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="container header-row">
        <div class="brand-row">
          <a class="brand" href="/dashboard">
            <span class="brand-mark">H</span>
            <span>Hippo</span>
          </a>
          <nav class="nav">
            <a class="nav-item nav-item-active" href="#overview">Overview</a>
            <a class="nav-item" href="#runs">Runs</a>
            <a class="nav-item" href="#workflows">Workflows</a>
          </nav>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline btn-sm" type="button" data-theme-toggle aria-label="Switch theme">Dark</button>
        </div>
      </div>
    </header>
    <main class="container main" id="overview">
      <div class="page-header">
        <div class="page-title">
          <h1>Hippo dashboard</h1>
          <p>Run state, retry pressure, and workflow topology in one place.</p>
        </div>
        <div class="header-actions">
          <a class="btn btn-outline btn-sm" href="/metrics">Metrics</a>
        </div>
      </div>

      <section class="stat-grid">
        <article class="card">
          <div class="card-header card-header-row">
            <h3 class="card-title-sm">Active runs</h3>
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 12-4 4-3-9-3 18-3-13H2"/></svg>
          </div>
          <div class="card-content">
            <div class="stat-value">${String(activeRunCount)}</div>
            <p class="stat-foot">Queued, running, or waiting</p>
          </div>
        </article>
        <article class="card">
          <div class="card-header card-header-row">
            <h3 class="card-title-sm">Failed runs</h3>
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <div class="card-content">
            <div class="stat-value">${String(failedRunCount)}</div>
            <p class="stat-foot">Terminal failures requiring review</p>
          </div>
        </article>
        <article class="card">
          <div class="card-header card-header-row">
            <h3 class="card-title-sm">Registered workflows</h3>
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
          </div>
          <div class="card-content">
            <div class="stat-value">${String(workflowCount)}</div>
            <p class="stat-foot">Definitions available to start</p>
          </div>
        </article>
      </section>

      <section class="two-col" id="runs">
        <article class="card">
          <div class="card-header">
            <h3 class="card-title">Active runs</h3>
            <p class="card-description">Queued, running, and waiting work.</p>
          </div>
          <div class="card-content stack">${args.activeRunsHtml}</div>
        </article>
        <article class="card">
          <div class="card-header">
            <h3 class="card-title">Failed runs</h3>
            <p class="card-description">Terminal failures that may need retry or inspection.</p>
          </div>
          <div class="card-content stack">${args.failedRunsHtml}</div>
        </article>
      </section>

      <section class="card" id="workflows">
        <div class="card-header">
          <h3 class="card-title">Workflow definitions</h3>
          <p class="card-description">Registered workflows with rendered topology previews.</p>
        </div>
        <div class="card-content stack">${args.workflowsHtml}</div>
      </section>
    </main>
    ${renderMermaidBootstrap()}
  </body>
</html>`
}

const renderDashboardRun = (run: {
  id: string
  definitionName: string
  status: keyof typeof statusToneByRun
  currentStepKey: string | null
  availableAt: Date
  updatedAt: Date
}) => `<article class="run-card">
  <div class="row">
    <a class="run-title" href="${dashboardRunPath(run.id)}">${escapeHtml(run.definitionName)}</a>
    <span class="badge ${statusToneByRun[run.status]}">${escapeHtml(run.status)}</span>
  </div>
  <div class="meta">${escapeHtml(run.id)}</div>
  <div class="meta">step ${escapeHtml(run.currentStepKey ?? "—")} · updated ${escapeHtml(formatDateTime(run.updatedAt))}</div>
</article>`

const renderWorkflowCard = (args: {
  mermaid: string
  workflowName: string
  workflowTitle?: string
}) => `<article class="workflow-card">
  <div class="workflow-info">
    <h3>${escapeHtml(args.workflowTitle ?? args.workflowName)}</h3>
    <div class="meta">${escapeHtml(args.workflowName)}</div>
    <p>Static topology preview for the registered definition.</p>
    <a class="link-action" href="/v1/workflows/${encodeURIComponent(args.workflowName)}/render">View source →</a>
  </div>
  <div class="workflow-diagram">${renderMermaidMount(args.mermaid)}</div>
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
    <style>${shadcnThemeTokens}${shadcnBaseStyles}
      .main {
        padding-top: 1.5rem;
        padding-bottom: 4rem;
        display: grid;
        gap: 1.5rem;
      }

      .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .page-title h1 {
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.025em;
        line-height: 1.2;
      }
      .page-title p {
        font-size: 0.875rem;
        color: hsl(var(--muted-foreground));
        margin-top: 0.375rem;
      }
      .page-title .meta-id {
        display: inline-block;
        margin-top: 0.5rem;
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
      }

      .summary { display: grid; gap: 0.75rem; }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        font-size: 0.875rem;
      }
      .summary-row > span:first-child { color: hsl(var(--muted-foreground)); }
      .summary-row > span:last-child {
        font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
        font-size: 0.8125rem;
      }

      .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin: 0 0 0.75rem;
        color: hsl(var(--foreground));
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
        font-size: 0.8125rem;
        padding: 0.75rem;
        background: hsl(var(--muted) / 0.5);
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        color: hsl(var(--foreground));
      }

      .card-list { display: grid; gap: 0.75rem; }

      .entry {
        padding: 1rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--card));
      }
      .entry strong {
        display: block;
        margin-bottom: 0.375rem;
        font-size: 0.875rem;
        font-weight: 600;
      }
      .entry time {
        display: block;
        margin-bottom: 0.5rem;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
        font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
      }
      .entry pre { font-size: 0.75rem; }

      .diagram-shell {
        min-height: 260px;
        padding: 0.75rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--muted) / 0.4);
        overflow: auto;
      }

      .mermaid { min-width: 560px; }
      .mermaid-fallback {
        white-space: pre-wrap;
        font-family: ui-monospace, "SFMono-Regular", monospace;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
      }

      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: hsl(var(--muted-foreground));
      }
      .back-link:hover { color: hsl(var(--foreground)); }

      @media (max-width: 900px) {
        .container { padding: 0 1rem; }
        .grid { grid-template-columns: 1fr; }
        .nav { display: none; }
        .mermaid { min-width: 360px; }
      }
    </style>
  </head>
  <body>
    <header class="site-header">
      <div class="container header-row">
        <div class="brand-row">
          <a class="brand" href="/dashboard">
            <span class="brand-mark">H</span>
            <span>Hippo</span>
          </a>
          <nav class="nav">
            <a class="nav-item" href="/dashboard">Overview</a>
            <a class="nav-item nav-item-active" href="#">Run detail</a>
          </nav>
        </div>
        <div class="header-actions">
          <a class="back-link" href="/dashboard">← Back to dashboard</a>
          <button class="btn btn-outline btn-sm" type="button" data-theme-toggle aria-label="Switch theme">Dark</button>
        </div>
      </div>
    </header>
    <main class="container main">
      <div class="page-header">
        <div class="page-title">
          <h1>${escapeHtml(args.run?.definitionName ?? "Run")}</h1>
          <p>Live event tail powered by <code>GET /v1/runs/:runId/stream</code>.</p>
          <div class="meta meta-id">${escapeHtml(args.run?.id ?? "")}</div>
        </div>
        <span class="badge ${
          args.run?.status && args.run.status in statusToneByRun
            ? statusToneByRun[args.run.status as keyof typeof statusToneByRun]
            : "tone-canceled"
        }">${escapeHtml(args.run?.status ?? "missing")}</span>
      </div>
      <section class="grid">
        <article class="card">
          <div class="card-header">
            <h3 class="card-title">Run detail</h3>
            <p class="card-description">Status, context, and topology for this run.</p>
          </div>
          <div class="card-content">
            <div class="summary">
              <div class="summary-row"><span>Status</span><span>${escapeHtml(args.run?.status ?? "missing")}</span></div>
              <div class="summary-row"><span>Current step</span><span>${escapeHtml(args.run?.currentStepKey ?? "—")}</span></div>
              <div class="summary-row"><span>Created</span><span>${escapeHtml(formatDateTime(args.run?.createdAt ?? null))}</span></div>
              <div class="summary-row"><span>Updated</span><span>${escapeHtml(formatDateTime(args.run?.updatedAt ?? null))}</span></div>
              <div class="summary-row"><span>Completed</span><span>${escapeHtml(formatDateTime(args.run?.completedAt ?? null))}</span></div>
            </div>
            <h4 class="section-title" style="margin-top: 1.5rem;">Context</h4>
            <pre>${formatJson(args.run?.context ?? {})}</pre>
            <h4 class="section-title" style="margin-top: 1.5rem;">Workflow map</h4>
            <div class="diagram-shell">${renderMermaidMount(args.workflowMermaid)}</div>
          </div>
        </article>
        <article class="card">
          <div class="card-header">
            <h3 class="card-title">Attempts</h3>
            <p class="card-description">Per-step execution history.</p>
          </div>
          <div class="card-content card-list">${args.attempts}</div>
        </article>
      </section>
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">Live events</h3>
          <p class="card-description">New events stream in via SSE.</p>
        </div>
        <div class="card-content">
          <div id="event-list" class="card-list">${args.events}</div>
        </div>
      </article>
    </main>
    ${renderMermaidBootstrap()}
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
  kind?: string
  attempt: number
  completedAt: Date | null
  error: JsonValue | null
  output: JsonValue | null
  startedAt: Date
  status: string
  stepKey: string
}) => `<article class="entry">
  <strong>${escapeHtml(attempt.stepKey)} · ${escapeHtml(attempt.kind === "compensate" ? "compensate" : "attempt")} ${String(attempt.attempt)}</strong>
  <time>${escapeHtml(formatDateTime(attempt.startedAt))} → ${escapeHtml(formatDateTime(attempt.completedAt))}</time>
  <pre>${formatJson({
    kind: attempt.kind ?? "forward",
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

const getIdempotencyKey = (request: FastifyRequest) => {
  const header =
    request.headers["idempotency-key"] ??
    request.headers["x-idempotency-key"]

  return typeof header === "string" && header.length > 0 ? header : undefined
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

const compensateRunTree = async (args: {
  engine: WorkflowEngine
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await compensateRunTree({
      engine: args.engine,
      runId: childRun.id,
      store: args.store,
    })
  }

  return args.engine.runCompensation(args.runId)
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
    const workflow = args.engine.getWorkflow(
      run.definitionName,
      run.definitionVersion
    )
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
      workflowMermaid: renderWorkflowAsMermaid(workflow, {
        ...(run.currentStepKey === null
          ? {}
          : { highlightedStepKey: run.currentStepKey }),
      }),
    })

    reply.header("content-type", "text/html; charset=utf-8")
    return document
  })

  app.post("/v1/workflows/:workflowName/runs", async (request, reply) => {
    requireApiAuth(app, request, args.auth)

    const params = workflowNameParamsSchema.parse(request.params)
    const body = startRunBodySchema.parse(request.body ?? {})
    const idempotencyKey = getIdempotencyKey(request)

    if (!args.engine.hasWorkflow(params.workflowName)) {
      throw app.httpErrors.notFound(
        `Workflow "${params.workflowName}" is not registered`
      )
    }

    const run = await args.engine.startRun({
      workflowName: params.workflowName,
      payload: body.payload,
      taskQueue: body.taskQueue,
      priority: body.priority,
      ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
    })

    reply.code(202)
    return {
      runId: run.id,
      status: run.status,
      currentStepKey: run.currentStepKey,
      taskQueue: run.taskQueue,
      priority: run.priority,
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

    const compensatedRun =
      body.mode === "hard"
        ? await compensateRunTree({
        engine: args.engine,
        runId: run.id,
        store: args.store,
          })
        : null

    return {
      runId: run.id,
      status: compensatedRun?.status ?? run.status,
      currentStepKey: compensatedRun?.currentStepKey ?? run.currentStepKey,
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

    const compensatedRun = await compensateRunTree({
      engine: args.engine,
      runId: run.id,
      store: args.store,
    })

    return {
      runId: run.id,
      status: compensatedRun?.status ?? run.status,
      currentStepKey: compensatedRun?.currentStepKey ?? run.currentStepKey,
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
      payload: body.payload,
      taskQueue: body.taskQueue,
      priority: body.priority,
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

  app.get("/v1/runs/:runId/context", async (request) => {
    requireApiAuth(app, request, args.auth)

    const params = runIdParamsSchema.parse(request.params)
    const query = runContextQuerySchema.parse(request.query)
    const run = await getExistingRun(app, args.store, params.runId)
    const keys =
      query.keys
        ?.split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0) ?? []

    return {
      runId: run.id,
      workflowName: run.definitionName,
      context: projectRunContext(run.context, keys),
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
