# Hippo

## Purpose

Hippo is a durable workflow engine for backend operations, messaging, and agentic tasks.
It executes workflows by checkpointing progress directly in a relational database so any worker can recover interrupted work without relying on a separate orchestration service.

Hippo is designed to be:

- Durable by default
- Database-native
- Recoverable after process or host failure
- Observable through SQL and metrics
- Small enough to self-host without heavy control-plane infrastructure

## Product Position

Hippo is a workflow runtime, not a queue wrapper and not a general BPM suite.
It sits between application code and external side effects.
Its job is to make long-running, multi-step, failure-prone processes reliable.

Hippo should be suitable for:

- Notification delivery pipelines
- API fanout and reconciliation jobs
- Human-in-the-loop tasks
- Agent workflows with retries and resumability
- Scheduled operational jobs
- Callback-driven integrations

Hippo should not optimize first for:

- Drag-and-drop business process modeling
- End-user workflow authoring
- Massive DAG analytics workloads
- Cross-region consensus as a core feature

## Core Thesis

Workflow durability comes from durable state, not from a specialized orchestrator tier.
Hippo treats the database as the source of truth for execution state, leases, checkpoints, retries, and recovery.

Workers are stateless compute.
If a worker crashes, another worker should be able to resume the workflow from its last committed checkpoint.

## Goals

- Execute workflows with step-level durability
- Recover incomplete workflows automatically after crashes
- Support both synchronous and callback-driven steps
- Guarantee at-least-once execution with strong idempotency support
- Make execution history inspectable with SQL
- Keep infrastructure footprint minimal
- Support Postgres first, with a possible SQLite mode for single-node deployments

## Non-Goals

- Exactly-once delivery across arbitrary third-party systems
- Distributed transactions across external APIs
- Visual workflow editing in v1
- Multi-tenant billing and hosted control plane in v1
- Arbitrary language SDKs in v1

## Users

### Primary Users

- Backend engineers building reliable application workflows
- Platform teams replacing cron scripts, queues, and custom retry code
- Teams building agentic systems that need resumable tool execution

### Secondary Users

- SREs needing visibility into stuck, failing, or retrying workflows
- Product engineers integrating external providers with callback-based completion

## High-Level Model

Hippo has five main concepts:

### Workflow Definition

A workflow definition describes a sequence or graph of steps.
Definitions live in application code and are versioned with deployments.

### Workflow Run

A workflow run is one execution instance of a workflow definition.
It has input, status, timestamps, and a durable execution history.

### Step

A step is a named unit of work.
A step may be:

- Pure compute
- A database mutation
- An external API call
- A wait-for-callback point
- A timer or scheduled delay

### Checkpoint

A checkpoint is the durable record of step progress or output.
Checkpointed state is what allows replay and recovery.

### Lease

A lease is a time-bounded claim by a worker on a runnable unit of work.
Leases prevent multiple workers from advancing the same run concurrently.

## Execution Semantics

### Core Guarantee

Hippo guarantees that a workflow can resume from its last committed checkpoint after worker failure.

### Delivery Model

Hippo v1 should provide:

- At-least-once step execution
- Durable retries
- Stable step-scoped idempotency keys for external side effects
- Duplicate-resistant callback resumption

### Worker Behavior

Workers poll or subscribe for runnable work.
When a worker claims a run, it acquires a lease in the database.
Each step transition is recorded durably before the worker advances to the next step.

If the worker dies:

- The lease expires
- Another worker can reclaim the run
- Execution resumes from the last committed state

## Workflow Types

Hippo v1 should support:

- Linear workflows
- Conditional branches
- Fanout over collections
- Join/wait states
- Callback waits
- Sleep/until-time steps
- Retryable failure paths

Hippo v1 may defer:

- Arbitrary cyclic workflows beyond controlled retries
- Large-scale map-reduce style execution
- Dynamic graph mutation mid-run

## Step Types

### Transaction Step

Runs code whose result is committed with workflow progress in the database.

### Activity Step

Calls external systems.
Must support retry policy, timeout, and idempotency metadata.

### Callback Wait Step

Persists a wait state and returns control.
A later external event resumes the run using a correlation key.

### Timer Step

Suspends execution until a target time, after which the run becomes eligible again.

## Failure Model

Hippo must treat the following as routine, not exceptional:

- Worker crash
- Process restart
- Host restart
- Network timeout to external service
- Duplicate callback delivery
- Slow or missing callback
- Database reconnect event

A failed step should record:

- Failure type
- Error message
- Attempt count
- Retry eligibility
- Next retry time

## Storage Model

Hippo should use Postgres as the primary backend.

### Required Tables

- `workflow_runs`
- `workflow_step_attempts`
- `workflow_events`
- `workflow_waits`

### Storage Principles

- Immutable event history where possible
- Explicit run status transitions
- Strong indexing on runnable and stuck work queries
- Correlation keys for callback-based resumption
- Queryable attempt history per step

## Recovery and Scheduling

Hippo should have a recovery loop that periodically:

- Finds expired leases
- Requeues orphaned runnable work
- Detects stuck runs
- Promotes due timer-delayed runs
- Surfaces dead-lettered runs

This recovery behavior is a core product feature, not an operational add-on.

## API Surface

Hippo v1 should expose:

### Developer API

- Define workflow
- Start run
- Resume callback wait
- Query run state
- Cancel run
- Retry failed run

### Operator API

- List active runs
- List failed runs
- List stuck runs
- Inspect step history
- Force retry
- Force cancel

### Event Ingestion API

- Submit external callback using correlation key
- Authenticate callback source
- Record raw payload for audit/debugging

## Observability

Hippo should be inspectable without proprietary tooling.

### Minimum Observability Requirements

- SQL-friendly schema for run inspection
- Structured logs with run ID and step ID
- Prometheus metrics
- Admin endpoints for health and queue depth

### Core Metrics

- Runs started
- Runs completed
- Runs failed
- Step attempts
- Retry counts
- Callback waits open
- Lease reclaim count
- Recovery loop actions
- End-to-end workflow latency

## Security

Hippo should support:

- Authenticated API access
- Callback authentication and signature validation
- Encryption of sensitive step payloads at rest when required
- Redaction controls for logs and admin views
- Audit trail for operator actions

## Deployment Modes

### Postgres Mode

Default production mode.
Multiple workers coordinate through Postgres.

### SQLite Mode

Optional single-node mode for local development, edge deployments, or low-scale self-hosting.
If implemented, SQLite mode should preserve the same execution semantics where practical, with clear documentation about durability and failover tradeoffs.

## v1 Scope

Hippo v1 should include:

- TypeScript runtime
- Postgres backend
- Durable workflow runs with step checkpoints
- Leased worker execution
- Callback waits and resume
- Timers
- Retry policies
- Metrics and health endpoints
- Simple operator API

Hippo v1 should exclude:

- Visual designer
- Hosted SaaS control plane
- Multi-language SDKs
- Complex RBAC model
- Built-in inbox/outbox for every third-party provider

## Open Questions

- Should workflow definitions be purely code-defined, or also persisted in the database for version-aware replay?
- Should retries be encoded per step, per workflow, or both?
- How much payload data should be stored inline versus referenced externally?
- Should callback correlation keys be first-class global entities?
- Is SQLite mode worth shipping in v1 or better deferred until Postgres semantics are solid?
- Should fanout/join be primitive constructs or compiled from simpler step semantics?

## Success Criteria

Hippo is successful if:

- A worker can crash mid-run and another worker resumes without manual intervention
- Operators can answer workflow-state questions using SQL and metrics
- Callback-driven workflows can pause and resume reliably
- Application teams can replace custom retry logic with Hippo workflows
- The system remains operationally small compared with external orchestrators

## Summary

Hippo is a database-native durable workflow engine.
Its value is not that it moves work from one step to another.
Its value is that workflow state survives failure cleanly, remains inspectable, and can be resumed deterministically by any worker.
