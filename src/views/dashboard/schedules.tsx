import { h } from "./jsx-runtime.js"
import type { WorkflowScheduleRecord } from "../../types/workflow.js"
import { escapeHtml, formatDateTime, renderShellDocument } from "./shell.js"

export const renderSchedulesIndexDocument = (args: {
  schedules: WorkflowScheduleRecord[]
  workflows: { name: string; title?: string }[]
}) => {
  const tableRows = args.schedules.length > 0
    ? args.schedules.map((s) => {
        const pauseResumeForm = s.active
          ? `
            <form method="POST" action="/dashboard/schedules/${s.id}/pause" style="display:inline;">
              <button class="btn btn-outline btn-sm" type="submit">Pause</button>
            </form>
          `
          : `
            <form method="POST" action="/dashboard/schedules/${s.id}/resume" style="display:inline;">
              <button class="btn btn-outline btn-sm" type="submit">Resume</button>
            </form>
          `

        const deleteForm = `
          <form method="POST" action="/dashboard/schedules/${s.id}/delete" style="display:inline;" onsubmit="return confirm('Are you sure you want to delete this schedule?');">
            <button class="btn btn-danger btn-sm" type="submit">Delete</button>
          </form>
        `

        return `
          <tr>
            <td><a href="/dashboard/definitions/${encodeURIComponent(s.workflowName)}">${escapeHtml(s.workflowName)}</a></td>
            <td class="mono">${escapeHtml(s.cronExpression)}</td>
            <td>${escapeHtml(s.taskQueue)}</td>
            <td>${String(s.priority)}</td>
            <td>
              <span class="badge ${s.active ? "tone-completed" : "tone-canceled"}">
                ${s.active ? "Active" : "Paused"}
              </span>
            </td>
            <td class="mono">${formatDateTime(s.nextFireAt)}</td>
            <td>
              <div class="row" style="gap: 0.5rem; justify-content: flex-start;">
                ${pauseResumeForm}
                ${deleteForm}
              </div>
            </td>
          </tr>
        `
      }).join("")
    : `<tr><td colspan="7" class="empty">No schedules registered.</td></tr>`

  const workflowOptions = args.workflows
    .map((w) => `<option value="${escapeHtml(w.name)}">${escapeHtml(w.title ?? w.name)}</option>`)
    .join("")

  const createFormHtml = args.workflows.length > 0
    ? `
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">Create Schedule</h3>
          <p class="card-description">Schedule a workflow definition to run on a cron expression.</p>
        </div>
        <div class="card-content">
          <form method="POST" action="/dashboard/schedules" style="display: flex; flex-direction: column; gap: 1rem; max-width: 500px;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label for="field-workflow" style="font-size: 0.875rem; font-weight: 500;">Workflow</label>
              <select id="field-workflow" name="workflowName" style="padding: 0.5rem; border-radius: 4px; border: 1px solid hsl(var(--border)); background: transparent; color: inherit;" required>
                ${workflowOptions}
              </select>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label for="field-cron" style="font-size: 0.875rem; font-weight: 500;">Cron Expression (e.g. */5 * * * *)</label>
              <input id="field-cron" name="cronExpression" type="text" placeholder="*/5 * * * *" style="padding: 0.5rem; border-radius: 4px; border: 1px solid hsl(var(--border)); background: transparent; color: inherit;" required />
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label for="field-queue" style="font-size: 0.875rem; font-weight: 500;">Task Queue</label>
              <input id="field-queue" name="taskQueue" type="text" value="default" style="padding: 0.5rem; border-radius: 4px; border: 1px solid hsl(var(--border)); background: transparent; color: inherit;" required />
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label for="field-priority" style="font-size: 0.875rem; font-weight: 500;">Priority</label>
              <input id="field-priority" name="priority" type="number" value="0" style="padding: 0.5rem; border-radius: 4px; border: 1px solid hsl(var(--border)); background: transparent; color: inherit;" required />
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <label for="field-payload" style="font-size: 0.875rem; font-weight: 500;">JSON Payload (optional)</label>
              <textarea id="field-payload" name="payload" placeholder="{}" rows="3" style="padding: 0.5rem; border-radius: 4px; border: 1px solid hsl(var(--border)); background: transparent; color: inherit; font-family: monospace;"></textarea>
            </div>
            <button class="btn btn-primary" type="submit" style="align-self: flex-start;">Create Schedule</button>
          </form>
        </div>
      </article>
    `
    : `<div class="empty">Register workflows before scheduling.</div>`

  const content = `
    <div class="page-bar">
      <div>
        <h1>Schedules</h1>
        <p>Manage server-side cron triggers that automatically start workflow runs.</p>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem; align-items: start;">
      <article class="card">
        <div class="card-header">
          <h3 class="card-title">Registered Schedules</h3>
        </div>
        <div class="card-content" style="overflow-x: auto;">
          <table class="table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left;">Workflow</th>
                <th style="text-align: left;">Cron Expression</th>
                <th style="text-align: left;">Queue</th>
                <th style="text-align: left;">Priority</th>
                <th style="text-align: left;">Status</th>
                <th style="text-align: left;">Next Fire</th>
                <th style="text-align: left; width: 180px;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </article>

      ${createFormHtml}
    </div>
  `

  return renderShellDocument({
    activeNav: "schedules",
    content,
    title: "Schedules · Hippo",
  })
}
