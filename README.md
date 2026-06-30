# 🦛 Hippo

**Postgres-only durable workflow engine for AI agent harnesses.**

One database. No Redis, no Elasticsearch, no Kafka, no separate control plane — just Postgres and a Hippo app process. Agent harnesses are workflow engines wearing a trench coat: phase transitions, tool-budget caps, human-in-the-loop approvals, retries on flaky LLM calls, and rewinding past a hallucination are all workflow problems. Hippo handles them.

## Features

<table>
<tr>
<td align="center" width="33%">
<h3>🐘 Postgres-Native Core</h3>
Runs, attempts, waits, signals, schedules, outbox, and KV in one database. <code>LISTEN/NOTIFY</code> wakes workers the moment work becomes runnable.
</td>
<td align="center" width="33%">
<h3>🔁 Durable Retries</h3>
Per-step retry policy with capped exponential backoff and jitter — built for flaky LLM calls.
</td>
<td align="center" width="33%">
<h3>📨 Signals & Waits</h3>
Block on Slack approvals, webhook callbacks, or named signals without holding worker slots.
</td>
</tr>
<tr>
<td align="center">
<h3>🧭 Child Workflows</h3>
Spawn sub-agents (code edit, scan, summarize) in parallel and wait durably for results.
</td>
<td align="center">
<h3>🛑 Cancel & Terminate</h3>
Graceful stop at step boundaries, or hard terminate with cascading child cancellation and compensation.
</td>
<td align="center">
<h3>📚 Continue As New</h3>
Roll long runs into a fresh one with payload reset and a <code>continued_from_run_id</code> chain.
</td>
</tr>
<tr>
<td align="center">
<h3>🧵 Queue Routing</h3>
Task queues + priority so GPU-bound or LLM-bound workers don't fight for the same lease.
</td>
<td align="center">
<h3>🗓️ Cron Schedules</h3>
Server-side cron creates runs — no external trigger service.
</td>
<td align="center">
<h3>🧱 Same-Txn Step Commit</h3>
Write workflow progress and your business row in the same Postgres transaction.
</td>
</tr>
<tr>
<td align="center">
<h3>📦 Outbox Helper</h3>
Enqueue outbox rows inside step commits; drain loop delivers them later.
</td>
<td align="center">
<h3>⏪ Rewind & Fork</h3>
Recover from a bad reasoning path by branching a terminal run from a prior attempt's stored snapshot.
</td>
<td align="center">
<h3>💸 Budget Caps</h3>
Track cost in real-time; auto-abort with <code>exhausted_budget</code> before LLM spend runs away.
</td>
</tr>
<tr>
<td align="center">
<h3>🔑 Run-Scoped KV</h3>
Per-run scratchpad for stashing state across retries or phases without bloating the payload.
</td>
<td align="center">
<h3>📡 Live SSE Events</h3>
Stream typed progress (LLM tokens, tool calls) to monitoring UIs over Server-Sent Events.
</td>
<td align="center">
<h3>🌐 External Sessions</h3>
Attach long-running agent reasoning or ML jobs with heartbeats, live events, and cancellation hooks.
</td>
</tr>
<tr>
<td align="center">
<h3>🛰️ OTel Tracing</h3>
Nested spans for HTTP, worker ticks, steps, scheduler, recovery, outbox, store mutations.
</td>
<td align="center">
<h3>🗂️ Partitioned History</h3>
<code>workflow_step_attempts</code> and <code>workflow_events</code> hash-partitioned by <code>run_id</code>.
</td>
<td align="center">
<h3>🎨 Built-in Dashboard</h3>
Mermaid topology, clickable attempts, live event tails — operator UI ships in-process.
</td>
</tr>
</table>

## Quickstart

```bash
npm install -g pygmyhippo-cli
hippo init my-agent-app
cd my-agent-app
npm install
npm run hippo:dev
```

Boots Postgres via `docker compose`, runs migrations, starts API + worker. Open `http://127.0.0.1:3000/dashboard`.

Start a run:

```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/workflows/example-delivery/runs \
  -d '{"payload":{"email":"hello@example.com"}}'
```

## Packages

| Package | Purpose |
|---|---|
| [`pygmyhippo-sdk`](https://www.npmjs.com/package/pygmyhippo-sdk) | `defineWorkflow`, step helpers, types |
| [`pygmyhippo-core`](https://www.npmjs.com/package/pygmyhippo-core) | Engine, store, tracer, migrations |
| [`pygmyhippo-server`](https://www.npmjs.com/package/pygmyhippo-server) | Fastify app, worker loop, recovery, scheduler |
| [`pygmyhippo-cli`](https://www.npmjs.com/package/pygmyhippo-cli) | `hippo init` scaffolder |

```bash
npm install pygmyhippo-sdk pygmyhippo-core pygmyhippo-server
```

```ts
import { defineWorkflow, taskStep, endStep } from "pygmyhippo-sdk"
import { createHippoTracer, createWorkflowEngine, createWorkflowStore } from "pygmyhippo-core"
import { createApp, startWorkerLoop } from "pygmyhippo-server"
```

## Hippo vs the rest

| | **Hippo** | Temporal | Trigger.dev v4 | LangGraph Platform | Hatchet | Inngest | Restate | DBOS |
|---|---|---|---|---|---|---|---|---|
| Self-host pricing | **MIT, fully free** | MIT, fully free | Apache 2.0, fully free | **Enterprise tier only** for prod self-host | MIT, fully free | SSPL, free self-host | **BUSL — prod self-host needs paid licence** | Transact MIT; **Conductor paid for prod** |
| Stateful services | **Postgres** | Postgres/Cassandra + Elasticsearch | Postgres + Redis + ClickHouse + object store | Postgres + Redis | Postgres (+ RabbitMQ above ~100 rps) | Postgres + Redis | None (embedded RocksDB) | Postgres |
| Containers (self-host) | **2** (db + app) | 4–6 | 5+ | 3 | 2–3 | 3 | **1** (single binary) | 1 + app |
| Process model | Server | Server cluster | Server cluster | Server | Server | Server | Single binary | **Library in your app** |
| Language SDKs | TS | Go, Java, TS, Python, .NET, Ruby, PHP | TS (Python via bridge) | Python, JS | TS, Python, Go, Ruby | TS, Python, Go | TS, Java/Kotlin, Python, Go, Rust | TS, Python, Go, Java |
| Built-in operator UI | ✅ | Separate svc | ✅ | LangGraph Studio | ✅ | ✅ | ✅ | Paid (Conductor) |
| Same-tx business writes | ✅ *when app shares Hippo's Postgres* | ❌ | ❌ | ❌ | ❌ | ❌ | Partial (virtual objects) | ✅ *native — runs in-process* |
| Rewind / fork from prior attempt | ✅ | Reset | Replay | Checkpoint replay | Replay | Replay | Journal replay | ✅ (Time Travel) |
| Run-scoped KV scratchpad | ✅ | ❌ | ❌ | Graph state | ❌ | ❌ | ✅ | Partial |
| Agent budgets / SSE streaming | ✅ | Generic | ✅ (Realtime/AI) | Graph-native | Generic | AgentKit | Partial | Limited |
| Workflow-as-data (declarative state machine, Mermaid render) | ✅ | ❌ (code paths) | ❌ | Graph DSL | ❌ | ❌ | ❌ | ❌ (decorators) |
| Language-agnostic via HTTP API | ✅ | Server only | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ (library-bound) |

## Environment

Required: `DATABASE_URL`.

Optional: `HIPPO_ENV`, `HIPPO_ROLE`, `HIPPO_HOST`, `HIPPO_PORT`, `HIPPO_PUBLIC_BASE_URL`, `HIPPO_WORKER_ID`, `HIPPO_TASK_QUEUES`, `HIPPO_POLL_INTERVAL_MS`, `HIPPO_LEASE_MS`, `HIPPO_RECOVERY_INTERVAL_MS`, `HIPPO_SCHEDULE_INTERVAL_MS`, `HIPPO_OUTBOX_INTERVAL_MS`, `HIPPO_NOTIFICATION_CHANNEL`, `HIPPO_API_TOKEN`, `HIPPO_CALLBACK_SECRET`, `HIPPO_CALLBACK_TOLERANCE_SECONDS`.

`HIPPO_ENV=dev` keeps defaults permissive. `staging` / `prod` require `HIPPO_API_TOKEN` and `HIPPO_CALLBACK_SECRET`.

`HIPPO_ROLE=all` is the default. Set `HIPPO_ROLE=serve` for API-only processes or `HIPPO_ROLE=work` for worker-only processes.

Set `HIPPO_PUBLIC_BASE_URL` when workers and API servers are split so `humanTask` approval URLs point at the externally reachable HTTP host.

Deployment recipes: [`docs/deploy.md`](docs/deploy.md), `Dockerfile`, `fly.toml`, `railway.json`, `render.yaml`.

## Operating runs

Signal a waiting run:

```bash
curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/runs/<run-id>/signals/approved \
  -d '{"payload":{"approved":true}}'
```

Submit a signed human task decision:

```bash
curl -X POST -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/human-tasks/<signed-token> \
  -d '{"decision":"approve","data":{"reviewer":"alice"}}'
```

Cron schedule:

```bash
curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/schedules \
  -d '{"workflowName":"demo","cronExpression":"*/5 * * * *","payload":{},"taskQueue":"default","priority":0}'
```

Cancel / terminate:

```bash
curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/cancel \
  -d '{"mode":"graceful","reason":"operator request"}'

curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/terminate \
  -d '{"reason":"operator request"}'
```

Rewind / fork from a prior attempt:

```bash
curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/rewind \
  -d '{"toAttemptId":"<attempt-id>"}'

curl -X POST -H "Authorization: Bearer $HIPPO_API_TOKEN" -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/operators/runs/<run-id>/fork \
  -d '{"fromAttemptId":"<attempt-id>"}'
```

Filter runs / inspect lineage:

```bash
curl -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  "http://127.0.0.1:3000/v1/operators/runs?workflowName=demo-delivery&status=waiting&limit=25"

curl -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  "http://127.0.0.1:3000/v1/operators/runs/<run-id>/lineage"
```

Render a workflow as Mermaid:

```bash
npm run render:demo
```

## Tracing

`createHippoTracer()` emits nested spans across the runtime. To export, register your own OpenTelemetry SDK in the host process before booting Hippo.

## Testing

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
