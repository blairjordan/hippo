# Deploying Hippo

Hippo currently runs as a single Node process that starts the API server, worker loop, recovery loop, scheduler, and outbox drain together.

That means the deploy story today is:

- single container or single service per environment
- shared Postgres for durable state
- horizontal scale is possible, but each instance also serves HTTP

## Environment Matrix

Use the same application code in every environment and switch behavior only with env vars.

| Variable | Dev | Staging | Prod | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | required | required | required | Postgres connection |
| `HIPPO_ENV` | `dev` | `staging` | `prod` | auth strictness and environment mode |
| `HIPPO_HOST` | `127.0.0.1` | `0.0.0.0` | `0.0.0.0` | bind address |
| `HIPPO_PORT` | `3000` | `3000` | `3000` | HTTP port |
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

## Fly.io

`fly.toml` is included for a basic single-service deployment.

Before first deploy:

```bash
fly launch --copy-config --no-deploy
fly secrets set DATABASE_URL=... HIPPO_API_TOKEN=... HIPPO_CALLBACK_SECRET=...
fly deploy
```

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

## Current Limits

The process model has not yet been split into dedicated `server` and `worker` commands. Until that lands, the supported production shape is one service type that runs both in the same process.
