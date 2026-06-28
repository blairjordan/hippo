# Hippo Workflows Demo

This example demonstrates production-ready durable workflows built using Hippo's workspace packages (`@hippo/sdk`, `@hippo/core`, `@hippo/server`).

## Features Demonstrated

1. **Saga Pattern & Compensating steps** (`order-fulfillment`): Walks back completed steps to trigger rollback code on failure.
2. **Webhook Callback Waits** (`webhook-callback`): Pauses run execution waiting for external REST callback ingestion.
3. **Cron Scheduling** (`nightly-report`): Periodic time-triggered job dispatching.
4. **Signal-based Approvals with Timeout** (`approval-flow`): Long-running approval flows that fail cleanly on timeout.

---

## Getting Started

### 1. Start the database
If you don't have a running Postgres database, you can start one from the repository root:
```bash
docker-compose up -d postgres
```

### 2. Configure environment
Create a `.env` file inside this directory by copying the default template:
```bash
cp ../../.env.example .env
```
Make sure `DATABASE_URL` points to your Postgres database (e.g., `postgres://postgres:postgres@127.0.0.1:54322/postgres` if using the root compose service).

### 3. Run database migrations
Use the Hippo CLI to automatically initialize and run migrations on your database:
```bash
npx hippo migrate
```

### 4. Start the server
Run the development runner to start the HTTP server and the background execution loops:
```bash
npm run dev
```
The server will boot on `http://127.0.0.1:3000`. You can inspect workflow definitions and runs by visiting the web dashboard:
- [http://127.0.0.1:3000/dashboard](http://127.0.0.1:3000/dashboard)

---

## Triggering & Inspecting Workflows

All APIs require a bearer authentication token. In development, the default token is `demo-token` (configured in `.env`).

### 1. Saga Order Fulfillment

#### Successful execution:
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ord-123", "customerId":"cust-456", "amount": 49, "items":["book", "pen"]}' \
  http://127.0.0.1:3000/v1/workflows/order-fulfillment/runs
```
Check the console logs to see step 1, 2, and 3 executing in order.

#### Rollback / failure execution:
Pass an amount of `999` to trigger a simulated shipping timeout and watch the Saga rollback step 2 and step 1 in reverse:
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ord-fail", "customerId":"cust-456", "amount": 999, "items":["laptop"]}' \
  http://127.0.0.1:3000/v1/workflows/order-fulfillment/runs
```
In the logs, you will see the compensations execute:
1. `[Saga Compensation] Refund payment of $999 for order ord-fail.`
2. `[Saga Compensation] Releasing inventory for order ord-fail.`

---

### 2. Webhook Callback Wait

Start the workflow:
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"requestId":"req-abc", "callbackUrl":"http://my-api.com"}' \
  http://127.0.0.1:3000/v1/workflows/webhook-callback/runs
```
Take note of the returned `runId` from the JSON response.
In the dashboard or database, the run will stay in `waiting` status.

Resume the wait state by posting a callback payload:
*(Replace `YOUR_RUN_ID` with the actual run ID from the start response)*
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"status":"delivered", "recipient":"John Doe"}' \
  http://127.0.0.1:3000/v1/waits/web:YOUR_RUN_ID:req-abc/resume
```
You will see the workflow resume, log the callback payload, and complete successfully.

---

### 3. Cron Nightly Report

Create a recurring nightly report schedule (running every minute for local demo purposes):
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"workflowName":"nightly-report", "cronExpression":"*/1 * * * *", "taskQueue":"default"}' \
  http://127.0.0.1:3000/v1/operators/schedules
```
Wait a minute and check the console logs to see the Cron-triggered execution run database counts and print summary output.

---

### 4. Long-Running Approval with Timeout

Start the approval flow:
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"documentId":"doc-789", "approverId":"mgr-alice"}' \
  http://127.0.0.1:3000/v1/workflows/approval-flow/runs
```
Take note of the `runId` in the response.

#### Option A: Approve before timeout (Success)
Send the `"approve"` signal within 30 seconds:
*(Replace `YOUR_RUN_ID` with the actual run ID)*
```bash
curl -X POST \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{"approver":"mgr-alice"}' \
  http://127.0.0.1:3000/v1/runs/YOUR_RUN_ID/signals/approve
```
The flow will log approval and finish.

#### Option B: Wait for timeout (Failure/Expiration)
Do not send any signal. After 30 seconds, the recovery thread will detect the expired wait state, mark the run as `failed`, and record the error `Wait step expired`.
