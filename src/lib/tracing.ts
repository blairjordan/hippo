import { AsyncLocalStorage } from "node:async_hooks"

import {
  SpanStatusCode,
  context,
  propagation,
  trace,
  type Attributes,
  type Context,
  type Tracer,
} from "@opentelemetry/api"
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks"
import { W3CTraceContextPropagator } from "@opentelemetry/core"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import {
  BatchSpanProcessor,
  BasicTracerProvider,
} from "@opentelemetry/sdk-trace-base"
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions"

type TraceAttributeValue = string | number | boolean | null | undefined

export type TraceAttributes = Record<string, TraceAttributeValue>

export type HippoSpan = {
  addEvent: (name: string, attributes?: TraceAttributes) => void
  setAttributes: (attributes: TraceAttributes) => void
}

export type HippoTracer = {
  withSpan: <T>(
    args: {
      name: string
      attributes?: TraceAttributes
    },
    run: (span: HippoSpan) => Promise<T> | T
  ) => Promise<T>
}

export type OTelBootstrapConfig = {
  endpoint: string
  headers: Record<string, string>
  serviceName: string
  resourceAttributes: Record<string, string>
}

const createSpanOptions = (attributes?: TraceAttributes) => {
  const mappedAttributes = toAttributes(attributes)

  return mappedAttributes === undefined ? {} : { attributes: mappedAttributes }
}

const toAttributes = (attributes: TraceAttributes | undefined): Attributes | undefined => {
  if (!attributes) {
    return undefined
  }

  return Object.fromEntries(
    Object.entries(attributes).flatMap(([key, value]) =>
      value === undefined || value === null ? [] : [[key, value]]
    )
  )
}

const traceparentStorage = new AsyncLocalStorage<string>()

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error"

const parseOtelHeaders = (value: string | undefined) =>
  Object.fromEntries(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .flatMap((entry) => {
        const separatorIndex = entry.indexOf("=")

        if (separatorIndex <= 0) {
          return []
        }

        const key = entry.slice(0, separatorIndex).trim()
        const headerValue = entry.slice(separatorIndex + 1).trim()

        if (key.length === 0 || headerValue.length === 0) {
          return []
        }

        return [[key, headerValue]]
      })
  )

const parseOtelResourceAttributes = (value: string | undefined) =>
  Object.fromEntries(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .flatMap((entry) => {
        const separatorIndex = entry.indexOf("=")

        if (separatorIndex <= 0) {
          return []
        }

        const key = entry.slice(0, separatorIndex).trim()
        const attributeValue = entry.slice(separatorIndex + 1).trim()

        if (key.length === 0 || attributeValue.length === 0) {
          return []
        }

        return [[key, attributeValue]]
      })
  )

export const getOtelBootstrapConfig = (
  env: Record<string, string | undefined>
): OTelBootstrapConfig | null => {
  if (env.OTEL_SDK_DISABLED === "true") {
    return null
  }

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim()

  if (!endpoint) {
    return null
  }

  const resourceAttributes = {
    ...parseOtelResourceAttributes(env.OTEL_RESOURCE_ATTRIBUTES),
    [SEMRESATTRS_SERVICE_NAME]: env.OTEL_SERVICE_NAME?.trim() || "hippo",
    ...(env.HIPPO_ENV?.trim()
      ? { [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: env.HIPPO_ENV.trim() }
      : {}),
  }

  return {
    endpoint,
    headers: parseOtelHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
    serviceName: resourceAttributes[SEMRESATTRS_SERVICE_NAME] ?? "hippo",
    resourceAttributes,
  }
}

let tracingRegistration:
  | {
      shutdown: () => Promise<void>
      configKey: string
    }
  | null = null

const buildTracingConfigKey = (config: OTelBootstrapConfig) =>
  JSON.stringify(config)

export const registerOtelFromEnv = (args?: {
  env?: Record<string, string | undefined>
}) => {
  const config = getOtelBootstrapConfig(args?.env ?? process.env)

  if (!config) {
    return async () => undefined
  }

  const configKey = buildTracingConfigKey(config)

  if (tracingRegistration?.configKey === configKey) {
    return tracingRegistration.shutdown
  }

  const contextManager = new AsyncHooksContextManager().enable()
  const provider = new BasicTracerProvider({
    resource: resourceFromAttributes(config.resourceAttributes),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: config.endpoint,
          headers: config.headers,
        })
      ),
    ],
  })

  context.setGlobalContextManager(contextManager)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())
  trace.setGlobalTracerProvider(provider)

  const shutdown = async () => {
    await provider.shutdown()
    contextManager.disable()

    if (tracingRegistration?.configKey === configKey) {
      tracingRegistration = null
    }
  }

  tracingRegistration = {
    configKey,
    shutdown,
  }

  return shutdown
}

export const createHippoTracer = (args?: {
  scopeName?: string
  tracer?: Tracer
}): HippoTracer => {
  const scopeName = args?.scopeName ?? "hippo"
  const otelTracer = args?.tracer ?? trace.getTracer(scopeName)
  const contextStorage = new AsyncLocalStorage<Context>()

  const getTraceparentFromSpanContext = (spanCtx: {
    traceId: string
    spanId: string
    traceFlags: number
  }) => {
    const flags = spanCtx.traceFlags.toString(16).padStart(2, "0")
    return `00-${spanCtx.traceId}-${spanCtx.spanId}-${flags}`
  }

  const withSpan: HippoTracer["withSpan"] = async (input, run) => {
    let parentContext = contextStorage.getStore() ?? context.active()
    const activeTraceparent = getActiveTraceContext()
    if (activeTraceparent) {
      const carrier = { traceparent: activeTraceparent }
      parentContext = propagation.extract(parentContext, carrier)
    }
    const span = otelTracer.startSpan(
      input.name,
      createSpanOptions(input.attributes),
      parentContext
    )
    const spanContext = trace.setSpan(parentContext, span)
    const traceparent = getTraceparentFromSpanContext(span.spanContext())
    const activeSpan: HippoSpan = {
      addEvent: (name, attributes) => {
        span.addEvent(name, toAttributes(attributes))
      },
      setAttributes: (attributes) => {
        span.setAttributes(toAttributes(attributes) ?? {})
      },
    }

    return contextStorage.run(spanContext, () =>
      context.with(spanContext, () =>
        traceparentStorage.run(traceparent, async () => {
          try {
            const result = await run(activeSpan)
            span.setStatus({ code: SpanStatusCode.OK })
            return result
          } catch (error) {
            span.recordException(error instanceof Error ? error : new Error(getErrorMessage(error)))
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: getErrorMessage(error),
            })
            throw error
          } finally {
            span.end()
          }
        })
      )
    )
  }

  return {
    withSpan,
  }
}

export const getActiveTraceContext = (): string | undefined => {
  const stored = traceparentStorage.getStore()
  if (stored) {
    return stored
  }

  const carrier: Record<string, string> = {}
  propagation.inject(context.active(), carrier)
  return carrier["traceparent"]
}

export const withTraceContext = <T>(
  traceparent: string | undefined | null,
  run: () => Promise<T> | T
): Promise<T> => {
  if (!traceparent) {
    return Promise.resolve(run())
  }

  const carrier = { traceparent }
  const parentContext = propagation.extract(context.active(), carrier)
  return traceparentStorage.run(traceparent, () =>
    Promise.resolve(context.with(parentContext, run))
  )
}

export const createTraceAttributes = (args: {
  operation: string
  workflowName?: string
  workflowVersion?: number
  runId?: string
  stepKey?: string | null
  stepKind?: string
  taskQueue?: string
  workerId?: string
  attemptId?: string
  attemptNumber?: number
  attemptKind?: string
  retryCount?: number
  priority?: number
  childRunId?: string
  waitCorrelationKey?: string
  errorMessage?: string | null
}) => ({
  "hippo.operation": args.operation,
  ...(args.workflowName === undefined ? {} : { "workflow.name": args.workflowName }),
  ...(args.workflowVersion === undefined
    ? {}
    : { "workflow.version": args.workflowVersion }),
  ...(args.runId === undefined ? {} : { "workflow.run.id": args.runId }),
  ...(args.stepKey === undefined || args.stepKey === null
    ? {}
    : { "workflow.step.key": args.stepKey }),
  ...(args.stepKind === undefined ? {} : { "workflow.step.kind": args.stepKind }),
  ...(args.taskQueue === undefined ? {} : { "workflow.task_queue": args.taskQueue }),
  ...(args.workerId === undefined ? {} : { "workflow.worker.id": args.workerId }),
  ...(args.attemptId === undefined ? {} : { "workflow.attempt.id": args.attemptId }),
  ...(args.attemptNumber === undefined ? {} : { "workflow.attempt.number": args.attemptNumber }),
  ...(args.attemptKind === undefined ? {} : { "workflow.attempt.kind": args.attemptKind }),
  ...(args.retryCount === undefined ? {} : { "workflow.retry.count": args.retryCount }),
  ...(args.priority === undefined ? {} : { "workflow.priority": args.priority }),
  ...(args.childRunId === undefined ? {} : { "workflow.child.run_id": args.childRunId }),
  ...(args.waitCorrelationKey === undefined
    ? {}
    : { "workflow.wait.correlation_key": args.waitCorrelationKey }),
  ...(args.errorMessage === undefined || args.errorMessage === null
    ? {}
    : { "workflow.error.message": args.errorMessage }),
})
