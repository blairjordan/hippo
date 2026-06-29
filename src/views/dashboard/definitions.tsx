import { h } from "./jsx-runtime.js"
import type {
  WorkflowDefinition,
  WorkflowRunRecord,
} from "../../types/workflow.js"
import { escapeHtml, renderShellDocument } from "./shell.js"
import { renderMermaidMount, renderMermaidBootstrap } from "./mermaid.js"
import { renderRunsTableRow } from "./runs.js"
import { getWorkflowMermaidNodeIds } from "../../lib/workflow-definition.js"

export const renderDefinitionsIndexDocument = (args: {
  workflows: { name: string; title?: string; stepCount: number }[]
}) => {
  const cardsHtml = args.workflows
    .map(
      (workflow) => {
        const card = (
          <article class="card">
            <div class="card-header">
              <h3 class="card-title">{workflow.title ?? workflow.name}</h3>
              <p class="card-description">{workflow.name} · {String(workflow.stepCount)} steps</p>
            </div>
            <div class="card-content row">
              <a class="link-action" href={`/dashboard/definitions/${encodeURIComponent(workflow.name)}`}>Open definition →</a>
              <a class="link-action" href={`/v1/workflows/${encodeURIComponent(workflow.name)}/render`}>Source</a>
            </div>
          </article>
        )
        return String(card)
      }
    )
    .join("")

  const content = `
    <div class="page-bar">
      <div>
        <h1>Definitions</h1>
        <p>Workflow definitions registered with this engine.</p>
      </div>
    </div>
    <div class="stat-grid">${
      cardsHtml || '<div class="empty">No workflows are registered.</div>'
    }</div>
  `

  return renderShellDocument({
    activeNav: "definitions",
    content,
    title: "Definitions · Hippo",
  })
}

export const renderDefinitionDetailDocument = (args: {
  workflow: { name: string; title?: string }
  mermaid: string
  nodeActions?: Record<
    string,
    { label: string; nodeText?: string; stepKey?: string; href?: string }
  >
  runs: WorkflowRunRecord[]
}) => {
  const tableBody = args.runs.length > 0
    ? args.runs.map(r => String(renderRunsTableRow(r))).join("")
    : `<tr><td colspan="6" class="empty">No runs for this definition yet.</td></tr>`

  const workflowTitle = args.workflow.title ?? args.workflow.name
  const diagramHtml = renderMermaidMount(args.mermaid, args.nodeActions)

  const content = `
    <div class="page-bar">
      <div>
        <h1>${escapeHtml(workflowTitle)}</h1>
        <p>${escapeHtml(args.workflow.name)}</p>
      </div>
      <div class="row">
        <a class="btn btn-outline btn-sm" href="/dashboard/runs?definition=${encodeURIComponent(args.workflow.name)}">All runs</a>
        <a class="btn btn-outline btn-sm" href="/v1/workflows/${encodeURIComponent(args.workflow.name)}/render">Source</a>
      </div>
    </div>
    <article class="card">
      <div class="card-header">
        <h3 class="card-title">Topology</h3>
        <p class="card-description">Click a step to jump to its filtered run list.</p>
      </div>
      <div class="card-content">
        <nav class="tabs-nav">
          <button type="button" class="tab-btn active" data-tab-trigger="diagram">Diagram</button>
          <button type="button" class="tab-btn" data-tab-trigger="source">Source</button>
        </nav>
        <div id="pane-diagram" class="tab-pane">
          <div class="workflow-diagram">${diagramHtml}</div>
        </div>
        <div id="pane-source" class="tab-pane hidden">
          <pre style="margin: 0; max-height: 400px; overflow: auto; background: hsl(var(--muted) / 0.3); border: 1px solid hsl(var(--border)); padding: 1rem; border-radius: calc(var(--radius) - 2px); font-family: ui-monospace, monospace; font-size: 0.75rem;">${escapeHtml(args.mermaid)}</pre>
        </div>
      </div>
    </article>
    <article class="card">
      <div class="card-header">
        <h3 class="card-title">Recent runs</h3>
        <p class="card-description">Latest ${String(args.runs.length)} runs of this definition.</p>
      </div>
      <table class="runs-table">
        <thead>
          <tr>
            <th>Definition</th>
            <th>Status</th>
            <th>Current step</th>
            <th>Run id</th>
            <th>Created</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>${tableBody}</tbody>
      </table>
    </article>
  `

  return renderShellDocument({
    activeNav: "definitions",
    content,
    title: `${args.workflow.title ?? args.workflow.name} · Hippo`,
    includeMermaidBootstrap: renderMermaidBootstrap(),
    pageStyles: `
      .workflow-diagram {
        min-height: 240px;
        padding: 0.75rem;
        border: 1px solid hsl(var(--border));
        border-radius: calc(var(--radius) - 2px);
        background: hsl(var(--muted) / 0.4);
        overflow: auto;
      }
      .mermaid { min-width: 480px; }
      .mermaid .clickable { cursor: pointer; }
      .mermaid .clickable rect,
      .mermaid .clickable path,
      .mermaid .clickable polygon { transition: filter 0.15s; }
      .mermaid .clickable:hover rect,
      .mermaid .clickable:hover path,
      .mermaid .clickable:hover polygon { filter: brightness(1.15); }
      .mermaid-fallback {
        white-space: pre-wrap;
        font-family: ui-monospace, "SFMono-Regular", monospace;
        font-size: 0.75rem;
        color: hsl(var(--muted-foreground));
      }
    `,
  })
}

export const createWorkflowStepActions = (
  workflow: WorkflowDefinition,
  args?: {
    hrefByStepKey?: (stepKey: string) => string
  }
) =>
  Object.fromEntries(
    Object.entries(getWorkflowMermaidNodeIds(workflow)).map(([stepKey, nodeId]) => [
      nodeId,
      {
        ...(args?.hrefByStepKey === undefined
          ? {}
          : { href: args.hrefByStepKey(stepKey) }),
        label: `Inspect ${stepKey}`,
        nodeText: workflow.steps[stepKey]?.label ?? stepKey,
        stepKey,
      },
    ])
  )
