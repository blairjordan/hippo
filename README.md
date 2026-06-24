# 🦛 Hippo

Postgres-native durable workflow engine.

Hippo runs long-lived workflows with durable state in Postgres, leased workers, retries, waits, and recovery after worker failure.

## Development

```bash
npm install
npm run db:migrate
npm run typecheck
npm run test
npm run lint
```

## What Works

- Durable workflow runs persisted in Postgres
- Leased worker execution with `FOR UPDATE SKIP LOCKED`
- Retryable task steps with backoff and non-retryable error tags
- Durable waits, callback resume, and sleep/timer steps
- Operator APIs for run inspection, retry, cancel, and recovery reconcile
- Bearer-token protected operator APIs
- HMAC-verified callback resumes

## Run

```bash
npm run dev
```

## Scripts

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run render:demo
```
