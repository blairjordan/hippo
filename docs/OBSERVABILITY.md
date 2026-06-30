# Observability and OpenTelemetry Tracing

Hippo emits nested OpenTelemetry spans for HTTP requests, worker ticks, step execution, wait resumes, child workflows, scheduler passes, recovery, and outbox delivery. Trace context is persisted on runs and step attempts so a resumed run continues the original trace tree instead of starting over.

## Useful Span Attributes

Hippo step spans now carry stable attributes that are easy to filter on in production:

- `workflow.attempt.number`
- `workflow.retry.count`
- `workflow.task_queue`
- `workflow.priority`
- `workflow.child.run_id`
- `workflow.wait.correlation_key`

You will also see the standard Hippo dimensions already used elsewhere:

- `workflow.name`
- `workflow.version`
- `workflow.run.id`
- `workflow.step.key`
- `workflow.step.kind`
- `workflow.worker.id`

## Honeycomb Wiring

Hippo can bootstrap OTLP exporting directly from environment variables. The runtime enables OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

Exact env combo for Honeycomb:

```bash
export HIPPO_ENV=prod
export OTEL_SERVICE_NAME=hippo-api
export OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io/v1/traces
export OTEL_EXPORTER_OTLP_HEADERS="x-honeycomb-team=$HONEYCOMB_API_KEY,x-honeycomb-dataset=hippo-prod"
export OTEL_RESOURCE_ATTRIBUTES="service.namespace=hippo,service.version=0.1.0"
```

With that in place, starting Hippo normally is enough:

```bash
HIPPO_ROLE=all npm run start
```

The runtime wiring lives in [src/lib/tracing.ts](/home/blair/code/devmode/hippo/src/lib/tracing.ts:1) and is activated from [src/lib/process-runtime.ts](/home/blair/code/devmode/hippo/src/lib/process-runtime.ts:1).

## Runnable Snippet

A minimal bootstrap example is checked in at [examples/workflows-demo/src/honeycomb.ts](/home/blair/code/devmode/hippo/examples/workflows-demo/src/honeycomb.ts:1).

Run it with:

```bash
npx tsx examples/workflows-demo/src/honeycomb.ts
```

## Trace Context Propagation

Hippo stores W3C trace context in durable state:

- `workflow_runs.trace_context`
- `workflow_step_attempts.trace_context`

Use the helpers in [src/lib/tracing.ts](/home/blair/code/devmode/hippo/src/lib/tracing.ts:1) when you need to cross an async boundary yourself:

```ts
import {
  createHippoTracer,
  getActiveTraceContext,
  withTraceContext,
} from "./lib/tracing.js"

const tracer = createHippoTracer({ scopeName: "my-service" })

await tracer.withSpan(
  {
    name: "custom-span",
    attributes: {
      "custom.key": "value",
    },
  },
  async (span) => {
    span.addEvent("before-handoff")

    const traceparent = getActiveTraceContext()

    await withTraceContext(traceparent, async () => {
      await tracer.withSpan({ name: "resumed-work" }, async () => undefined)
    })
  }
)
```
