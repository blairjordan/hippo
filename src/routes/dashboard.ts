import type { JsonValue } from "../types/json.js"
import type {
  WorkflowEventRecord,
  WorkflowRunRecord,
  WorkflowStepAttemptRecord,
} from "../types/workflow.js"

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

export const renderDashboardDocument = (args: {
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

export const renderDashboardRun = (
  run: Pick<
    WorkflowRunRecord,
    "id" | "definitionName" | "status" | "currentStepKey" | "updatedAt"
  >
) => `<article class="run-card">
  <div class="row">
    <a class="run-title" href="${dashboardRunPath(run.id)}">${escapeHtml(run.definitionName)}</a>
    <span class="badge ${statusToneByRun[run.status]}">${escapeHtml(run.status)}</span>
  </div>
  <div class="meta">${escapeHtml(run.id)}</div>
  <div class="meta">step ${escapeHtml(run.currentStepKey ?? "—")} · updated ${escapeHtml(formatDateTime(run.updatedAt))}</div>
</article>`

export const renderWorkflowCard = (args: {
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

export const renderRunDetailDocument = (args: {
  attempts: string
  events: string
  lastEventId: number
  lineage: string
  run: WorkflowRunRecord | null
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
      .lineage-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

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
          <h3 class="card-title">Lineage</h3>
          <p class="card-description">Parent, continue-as-new, and rewind/fork relationships for this run.</p>
        </div>
        <div class="card-content lineage-grid">${args.lineage}</div>
      </article>
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

export const renderAttemptCard = (
  attempt: Pick<
    WorkflowStepAttemptRecord,
    "kind" | "attempt" | "completedAt" | "error" | "output" | "startedAt" | "status" | "stepKey"
  >
) => `<article class="entry">
  <strong>${escapeHtml(attempt.stepKey)} · ${escapeHtml(attempt.kind === "compensate" ? "compensate" : "attempt")} ${String(attempt.attempt)}</strong>
  <time>${escapeHtml(formatDateTime(attempt.startedAt))} → ${escapeHtml(formatDateTime(attempt.completedAt))}</time>
  <pre>${formatJson({
    kind: attempt.kind ?? "forward",
    status: attempt.status,
    output: attempt.output,
    error: attempt.error,
  })}</pre>
</article>`

export const renderEventCard = (
  event: Pick<WorkflowEventRecord, "createdAt" | "eventType" | "payload">
) => `<article class="entry">
  <strong>${escapeHtml(event.eventType)}</strong>
  <time>${escapeHtml(formatDateTime(event.createdAt))}</time>
  <pre>${formatJson(event.payload)}</pre>
</article>`

export const renderLineageRunCard = (
  run: Pick<
    WorkflowRunRecord,
    | "id"
    | "definitionName"
    | "status"
    | "currentStepKey"
    | "createdAt"
    | "parentRunId"
    | "continuedFromRunId"
    | "branchedFromRunId"
    | "supersededByRunId"
  >
) => `<article class="entry">
  <strong><a class="run-title" href="${dashboardRunPath(run.id)}">${escapeHtml(run.definitionName)}</a></strong>
  <time>${escapeHtml(formatDateTime(run.createdAt))}</time>
  <pre>${formatJson({
    id: run.id,
    status: run.status,
    currentStepKey: run.currentStepKey,
    parentRunId: run.parentRunId,
    continuedFromRunId: run.continuedFromRunId,
    branchedFromRunId: run.branchedFromRunId,
    supersededByRunId: run.supersededByRunId,
  })}</pre>
</article>`
