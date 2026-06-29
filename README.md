# 🦛 Hippo

Postgres-native durable workflow engine. Built for traditional application workflows AND for AI agent state machines.

Hippo runs long-lived workflows with Postgres as the only durable state layer: leased workers, retries, waits, signals, schedules, child workflows, transactional step commits, and recovery after worker failure.

> **For AI agents:** every serious agent harness — coding agents, research agents, ops agents — eventually needs a durable state machine to drive phase transitions, gate human approvals, retry with critic feedback, track token + USD budgets, and survive worker crashes mid-run. Hippo gives you that without forcing your agent code into a vendor framework. See [For AI Agents](#for-ai-agents) below.

## Why Hippo

Hippo is built for teams that want durable workflow orchestration without adding a separate control plane or managed dependency to their stack.

- Postgres-native durability means workflow state, waits, retries, outbox records, and operator history live in infrastructure most teams already run.
- Same-transaction step commit lets workflow progress and application writes commit together, which is the practical moat for payment, fulfillment, and callback-heavy systems.
- Local, staging, and prod environments share one runtime shape and one env model instead of requiring a second operational system to learn.
- The built-in dashboard and SSE event streams make workflow state visible without standing up a separate frontend.
- Operator queries now support filtered run listing plus lineage inspection for rewind, fork, continue-as-new, and parent-child chains.
- TypeScript-first workflow definitions keep business logic in ordinary application code instead of pushing teams into a separate workflow DSL.
- Version-pinned execution keeps in-flight runs on the exact workflow definition version they started with while new starts pick the latest registered version. Once a version is registered in-process, hot reload does not mutate that version's code.
- Hot audit tables are hash-partitioned by `run_id`, so run-scoped history reads stay prune-friendly as attempts and events grow.

## Where It Fits

Hippo is strongest when you need:

- durable application workflows backed by an existing Postgres deployment
- explicit retries, waits, signals, schedules, and compensation in one runtime
- operator visibility and intervention without bolting on extra control-plane services
- transactional workflow steps that touch your domain tables and workflow state together

Hippo is not trying to optimize for polyglot workers or extreme fan-out first. It is optimized for small and mid-scale TypeScript systems that want durable orchestration with simple operations.

## For AI Agents

Agent orchestration is converging on a known shape: deterministic state machine on the outside, agent reasoning on the inside. Phase gates (requirements → architecture → tasks → implementation), tool-scope restrictions per phase, critic loops with bounded retries, human-in-the-loop approvals, durable resume after crashes. None of that is agent-specific work — it is **workflow engine work**.

Hippo is built to be the engine underneath that pattern, without becoming a vendor agent framework. The engine stays generic and the agent layer is a thin contrib package on top.

What Hippo gives an agent harness today:

- **Durable phase transitions.** Each phase of an agent workflow is a step. Step state lives in Postgres. Worker crash mid-run resumes at the last completed step, not from scratch.
- **Human-in-the-loop via signals + waits.** Pause an agent workflow on a Slack approval, Linear comment, or any external callback. Workflow blocks for hours or days without burning a process. Wait expiry is first-class so workflows never hang forever.
- **Critic loops with retry policies.** Per-step retry policy with exponential backoff and non-retryable error tags. Compose with iterative refinement so each retry can see the previous attempt's output and critic feedback.
- **Operator rewind and fork.** When an agent goes sideways at phase 3 of 7, rewind to phase 1 with the original context snapshot. Branch into an alternate plan without losing the original run.
- **Live observability.** Mermaid render of the workflow, SSE event tail, clickable step inspection. See exactly which phase the agent is in and what it has produced.
- **Same-transaction step commit.** Commit workflow progress and your application writes (Linear ticket state, artifact records, audit rows) together in one Postgres transaction.
- **Cron schedules + child workflows.** Autonomous agents that poll an issue tracker, fan out per ticket, and coordinate across multiple in-flight features.

Hippo intentionally does NOT ship:

- An HTTP client for any specific agent harness (Claude Agent SDK, OpenAI Assistants, Hermes, etc.)
- A phase model — phases are application code, not engine state
- Prompt templates, critic prompts, or tool allowlists — those live in your agent layer
- Memory system integrations — agents bring their own memory

The agent-specific glue lives in a separate `@hippo-contrib/agents` package (in development on `feat/agent-primitives`) so the core engine stays usable for any long-running external workload — ML training jobs, video transcode pipelines, payment workflows, browser automation — without dragging in agent vocabulary.

If you are building an agent harness and reaching for LangGraph, Temporal, or Trigger.dev, Hippo is worth looking at:

- LangGraph is a graph DSL inside Python; Hippo is a runtime that lives next to your harness in any language.
- Temporal is a heavyweight durable execution engine with strict determinism rules; Hippo is a Postgres workflow engine you already know how to operate.
- Trigger.dev is a TypeScript task platform with Postgres + Redis + 5 containers; Hippo is one Postgres and one worker.

See `AGENTS-TODO.txt` on the `feat/agent-primitives` branch for the in-flight roadmap of agent-shaped generic primitives (long-running external sessions with reattach, token + USD budgets, streamed step events, external cancellation hooks, per-run scratchpads).

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>🐘 Postgres-Native Core</h3>
Workflow runs, step attempts, waits, signals, schedules, and outbox records live in Postgres. Workers stay stateless and recover from leases instead of carrying hidden local state.
</td>
<td align="center" width="33%">
<h3>⚡ Fast Wakeups</h3>
Workers still poll safely, but `LISTEN/NOTIFY` wakes them early when new runs, resumed waits, signals, or recovered work become runnable.
</td>
<td align="center" width="33%">
<h3>🔁 Durable Retries</h3>
Task steps support per-step retry policy with capped exponential backoff, jitter, and non-retryable error tags.
</td>
</tr>
<tr>
<td align="center">
<h3>📨 Signals And Waits</h3>
Runs can block on external callbacks or named signals, resume exactly once, and fail cleanly on wait expiry instead of hanging forever.
</td>
<td align="center">
<h3>🧭 Child Workflows</h3>
A parent run can spawn a child workflow, wait durably for its terminal state, and resume with the child result once the child completes.
</td>
<td align="center">
<h3>🛑 Graceful Cancel And Hard Terminate</h3>
Graceful cancellation stops at step boundaries. Hard termination cuts the run over to `canceled` immediately, propagates down child runs, and runs compensation for completed task steps that define it.
</td>
</tr>
<tr>
<td align="center">
<h3>📚 Continue As New</h3>
Task steps can roll long-running work into a fresh run with new payload while preserving an explicit chain link through `continued_from_run_id`.
</td>
<td align="center">
<h3>🧵 Queue Routing</h3>
Runs carry a task queue and priority so workers can specialize by workload instead of competing for one flat runnable set.
</td>
<td align="center">
<h3>🗓️ Cron Schedules</h3>
Server-side schedules create workflow runs from cron expressions without relying on an external trigger service.
</td>
</tr>
<tr>
<td align="center">
<h3>🧱 Same-Txn Step Commit</h3>
Transactional task steps can write application data and commit workflow progress in the same Postgres transaction.
</td>
<td align="center">
<h3>📦 Outbox Helper</h3>
Transactional steps can enqueue outbox records in the same transaction as step progress. A drain loop can deliver and mark them later.
</td>
<td align="center">
<h3>⏪ Rewind And Fork</h3>
Terminal runs can branch from a prior step attempt using the stored pre-step context snapshot, which gives operators a durable way to replay from an earlier boundary without mutating workflow code.
</td>
</tr>
<tr>
<td align="center">
<h3>🛰️ OTel Tracing</h3>
HTTP requests, worker ticks, step execution, scheduler dispatch, recovery, outbox delivery, and store mutations emit nested OpenTelemetry-compatible spans so traces stay connected through the full runtime path.
</td>
<td align="center">
<h3>🗂️ Partitioned History</h3>
`workflow_step_attempts` and `workflow_events` are hash-partitioned by `run_id`, which keeps the hot history tables friendlier to pruning and long-lived fan-out.
</td>
</tr>
</table>

## Quickstart

From this repo today, scaffold a new Hippo app:

```bash
npm install
npm run hippo:init -- my-hippo-app
cd my-hippo-app
npm install
npm run hippo:dev
```

This creates a local app skeleton with Docker-backed Postgres, the built-in
dashboard, and an example workflow under `src/workflows/example.ts`.

Then open `http://127.0.0.1:3000/dashboard` and start an example run:

```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/workflows/example-delivery/runs \
  -d '{"payload":{"email":"hello@example.com"}}'
```

The generated app includes:

- built-in dashboard with Mermaid workflow renders and SSE event tails
- clickable Mermaid step nodes on run detail pages for direct attempt inspection
- filtered operator run listing plus lineage inspection APIs
- durable retries with exponential backoff, jitter, and max delay cap
- graceful cancel, hard terminate, and compensation hooks
- public `hippo/sdk`, `hippo/core`, and `hippo/server` entrypoints for local package-style consumption
- workspace package previews under `packages/core`, `packages/sdk`, and `packages/server`
- local `docker compose` Postgres plus migrations and example workflow wiring

Required environment:

- `DATABASE_URL`

Optional environment:

- `HIPPO_ENV`
- `HIPPO_HOST`
- `HIPPO_PORT`
- `HIPPO_WORKER_ID`
- `HIPPO_TASK_QUEUES`
- `HIPPO_POLL_INTERVAL_MS`
- `HIPPO_LEASE_MS`
- `HIPPO_RECOVERY_INTERVAL_MS`
- `HIPPO_SCHEDULE_INTERVAL_MS`
- `HIPPO_OUTBOX_INTERVAL_MS`
- `HIPPO_NOTIFICATION_CHANNEL`
- `HIPPO_API_TOKEN`
- `HIPPO_CALLBACK_SECRET`
- `HIPPO_CALLBACK_TOLERANCE_SECONDS`

Environment-specific examples:

- `.env.example`
- `.env.staging.example`
- `.env.prod.example`

Development:

```bash
npm install
cp .env.example .env
npm run hippo:dev
```

This starts local Postgres via `docker compose`, waits for the database port,
runs migrations, then launches the API and worker.
In dev, changes under `src/workflows/*.ts` hot-reload registered definitions
without restarting the process. To change workflow behavior safely for new runs
while preserving pinned in-flight runs, bump the workflow `version`.

Environment modes:

- `HIPPO_ENV=dev` keeps local defaults permissive.
- `HIPPO_ENV=staging` and `HIPPO_ENV=prod` require both `HIPPO_API_TOKEN`
  and `HIPPO_CALLBACK_SECRET`.

Deployment recipes:

- [docs/deploy.md](docs/deploy.md)
- `Dockerfile`
- `fly.toml`
- `railway.json`
- `render.yaml`

If you prefer the steps manually:

```bash
docker compose up -d postgres
npm run db:migrate
npm run typecheck
npm run test
npm run lint
npm run dev
```

## Usage

Local public package entrypoints:

```ts
import { defineWorkflow, taskStep, endStep } from "hippo/sdk"
import { createHippoTracer, createWorkflowEngine, createWorkflowStore } from "hippo/core"
import { createApp, startWorkerLoop } from "hippo/server"
```

These entrypoints are verified locally through the package `exports` map today. The package is not published yet, so the source-repo workflow remains the supported install path.

Workspace package previews:

- `packages/core`
- `packages/sdk`
- `packages/server`

Running `npm run build` copies the compiled package-specific entrypoint artifacts
into those package directories so their exported entrypoints, manifests, and
README surfaces can be smoke-tested locally.

Tracing:

- Hippo exposes `createHippoTracer()` and emits nested spans through the runtime.
- To export traces, register your own OpenTelemetry SDK/provider in the host process before booting Hippo.

Start a run:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/workflows/demo-delivery/runs \
  -d '{"payload":{},"taskQueue":"default","priority":0}'
```

Send a signal:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/runs/<run-id>/signals/approved \
  -d '{"payload":{"approved":true}}'
```

Create a cron schedule:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/schedules \
  -d '{"workflowName":"demo","cronExpression":"*/5 * * * *","payload":{},"taskQueue":"default","priority":0}'
```

Cancel or terminate a run:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/cancel \
  -d '{"mode":"graceful","reason":"operator request"}'

curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/terminate \
  -d '{"reason":"operator request"}'
```

Rewind or fork a terminal run from a prior attempt:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/rewind \
  -d '{"toAttemptId":"<attempt-id>"}'

curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/fork \
  -d '{"fromAttemptId":"<attempt-id>"}'
```

Filter operator runs or inspect lineage:

```bash
curl -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  "http://127.0.0.1:3000/v1/operators/runs?workflowName=demo-delivery&status=waiting&search=delivery&limit=25"

curl -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  "http://127.0.0.1:3000/v1/operators/runs/<run-id>/lineage"
```

Render a workflow as Mermaid:

```bash
npm run render:demo
```

## Testing

Default checks:

```bash
npm run typecheck
npm run test
npm run lint
```

Postgres-backed integration tests:

```bash
HIPPO_PG_TEST_URL=postgres://postgres:postgres@127.0.0.1:55432/postgres \
  npm run test:pg
```
