import { trace, propagation, context } from "@opentelemetry/api"
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks"
import { W3CTraceContextPropagator } from "@opentelemetry/core"
import { BasicTracerProvider, SimpleSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base"
import { describe, expect, it, beforeAll } from "vitest"

import {
  createHippoTracer,
  getOtelBootstrapConfig,
  getActiveTraceContext,
  registerOtelFromEnv,
  withTraceContext,
} from "./tracing.js"

describe("OTel trace context propagation", () => {
  beforeAll(() => {
    const contextManager = new AsyncHooksContextManager()
    contextManager.enable()
    context.setGlobalContextManager(contextManager)

    const exporter = new InMemorySpanExporter()
    const provider = new BasicTracerProvider({
      spanProcessors: [
        new SimpleSpanProcessor(exporter)
      ]
    })
    trace.setGlobalTracerProvider(provider)
    propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  })

  it("serializes and propagates trace context correctly", async () => {
    const tracer = createHippoTracer({ scopeName: "test-tracing" })

    // Outside a span, trace context should be undefined or empty
    const outsideContext = getActiveTraceContext()
    expect(outsideContext).toBeUndefined()

    // Inside a span, it should capture the active traceparent
    await tracer.withSpan({ name: "parent-span" }, async () => {
      const traceContext = getActiveTraceContext()
      expect(traceContext).toBeDefined()
      expect(traceContext).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)

      // Inject the context to run a nested block asynchronously
      await withTraceContext(traceContext, async () => {
        const nestedContext = getActiveTraceContext()
        expect(nestedContext).toBe(traceContext)

        await tracer.withSpan({ name: "child-span" }, () => {
          const activeSpan = trace.getActiveSpan()
          expect(activeSpan).toBeDefined()
          
          // Verify that child span has parent's traceId
          const spanContext = activeSpan?.spanContext()
          expect(spanContext?.traceId).toBeDefined()
        })
      })
    })
  })

  it("parses env-driven OTLP bootstrap config", () => {
    expect(
      getOtelBootstrapConfig({
        HIPPO_ENV: "prod",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://api.honeycomb.io/v1/traces",
        OTEL_EXPORTER_OTLP_HEADERS:
          "x-honeycomb-team=test-key,x-honeycomb-dataset=hippo-prod",
        OTEL_RESOURCE_ATTRIBUTES: "service.namespace=hippo,service.version=0.1.0",
        OTEL_SERVICE_NAME: "hippo-api",
      })
    ).toEqual({
      endpoint: "https://api.honeycomb.io/v1/traces",
      headers: {
        "x-honeycomb-dataset": "hippo-prod",
        "x-honeycomb-team": "test-key",
      },
      resourceAttributes: {
        "deployment.environment": "prod",
        "service.name": "hippo-api",
        "service.namespace": "hippo",
        "service.version": "0.1.0",
      },
      serviceName: "hippo-api",
    })
  })

  it("skips OTLP bootstrap when disabled", async () => {
    const shutdown = registerOtelFromEnv({
      env: {
        OTEL_SDK_DISABLED: "true",
        OTEL_EXPORTER_OTLP_ENDPOINT: "https://api.honeycomb.io/v1/traces",
      },
    })

    await expect(shutdown()).resolves.toBeUndefined()
  })
})
