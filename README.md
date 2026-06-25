# 🦛 Hippo

Postgres-native durable workflow engine.

Hippo runs long-lived workflows with Postgres as the only durable state layer: leased workers, retries, waits, signals, schedules, child workflows, transactional step commits, and recovery after worker failure.

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
<h3>🗓️ Cron Schedules</h3>
Server-side schedules create workflow runs from cron expressions without relying on an external trigger service.
</td>
<td align="center">
<h3>🧱 Same-Txn Step Commit</h3>
Transactional task steps can write application data and commit workflow progress in the same Postgres transaction.
</td>
<td align="center">
<h3>📦 Outbox Helper</h3>
Transactional steps can enqueue outbox records in the same transaction as step progress. A drain loop can deliver and mark them later.
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
  -d '{"email":"hello@example.com"}'
```

The generated app includes:

- built-in dashboard with Mermaid workflow renders and SSE event tails
- durable retries with exponential backoff, jitter, and max delay cap
- graceful cancel, hard terminate, and compensation hooks
- local `docker compose` Postgres plus migrations and example workflow wiring

Required environment:

- `DATABASE_URL`

Optional environment:

- `HIPPO_ENV`
- `HIPPO_HOST`
- `HIPPO_PORT`
- `HIPPO_WORKER_ID`
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
runs migrations, then launches the API and worker with `tsx watch`.

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

Start a run:

```bash
curl -X POST \
  -H "Authorization: Bearer $HIPPO_API_TOKEN" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3000/v1/workflows/demo-delivery/runs \
  -d '{}'
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
  -d '{"workflowName":"demo","cronExpression":"*/5 * * * *","payload":{}}'
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
HIPPO_PG_TEST_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres \
  npm run test -- src/lib/workflow-store.pg.test.ts
```
