# Deploying Hippo

Hippo supports three runtime roles through `HIPPO_ROLE`:

- `all` starts the API server, dashboard, worker loop, recovery loop, scheduler, and outbox drain in one process.
- `serve` starts only the API server and dashboard.
- `work` starts only the worker loop, recovery loop, scheduler, and outbox drain.

`HIPPO_ROLE=all` is the default, so single-process deploys still work unchanged.

## Environment Matrix

Use the same application code in every environment and switch behavior only with env vars.

| Variable | Dev | Staging | Prod | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | required | required | required | Postgres connection |
| `HIPPO_ENV` | `dev` | `staging` | `prod` | auth strictness and environment mode |
| `HIPPO_ROLE` | `all` | `all`, `serve`, or `work` | `all`, `serve`, or `work` | process role selection |
| `HIPPO_HOST` | `127.0.0.1` | `0.0.0.0` | `0.0.0.0` | bind address |
| `HIPPO_PORT` | `3000` | `3000` | `3000` | HTTP port |
| `HIPPO_PUBLIC_BASE_URL` | optional | recommended | recommended | external base URL for signed human-task approval links |
| `HIPPO_TASK_QUEUES` | `default` | `default` | `default` | comma-separated worker queue subscriptions |
| `HIPPO_API_TOKEN` | optional | required | required | operator and API auth |
| `HIPPO_CALLBACK_SECRET` | optional | required | required | callback verification |
| `HIPPO_CALLBACK_TOLERANCE_SECONDS` | optional | optional | optional | callback clock skew window |

Example env files:

- `.env.example`
- `.env.staging.example`
- `.env.prod.example`

## Docker

Build and run:

```bash
docker build -t hippo .
docker run --rm -p 3000:3000 \
  --env-file .env.prod.example \
  hippo
```

The image compiles TypeScript during build and runs `npm run start` in production.

Single container:

```bash
docker run --rm -p 3000:3000 \
  -e HIPPO_ROLE=all \
  --env-file .env.prod.example \
  hippo
```

Split API and worker containers from the same image:

```bash
docker run --rm -p 3000:3000 -e HIPPO_ROLE=serve --env-file .env.prod.example hippo
docker run --rm -e HIPPO_ROLE=work --env-file .env.prod.example hippo
```

## Fly.io

`fly.toml` keeps the default single-process shape with `HIPPO_ROLE=all`.

Before first deploy:

```bash
fly launch --copy-config --no-deploy
fly secrets set DATABASE_URL=... HIPPO_API_TOKEN=... HIPPO_CALLBACK_SECRET=...
fly deploy
```

To split roles on Fly, run the same image under separate process groups and override `HIPPO_ROLE` per process group.

## Railway

`railway.json` is included for Dockerfile-based deploys.

Set these variables in the Railway UI:

- `DATABASE_URL`
- `HIPPO_ENV=prod`
- `HIPPO_API_TOKEN`
- `HIPPO_CALLBACK_SECRET`

## Render

`render.yaml` is included for a single web service deployment.

Create the service from the repo, then set:

- `DATABASE_URL`
- `HIPPO_API_TOKEN`
- `HIPPO_CALLBACK_SECRET`

## Recommended Shapes

- Small installs: one `HIPPO_ROLE=all` process.
- Larger installs: one or more `HIPPO_ROLE=serve` processes behind HTTP plus one or more `HIPPO_ROLE=work` processes for background throughput.
