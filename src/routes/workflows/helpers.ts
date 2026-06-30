import type { FastifyInstance, FastifyRequest } from "fastify"

import type { HippoAuth } from "../../lib/auth.js"
import type { HippoMetrics } from "../../lib/metrics.js"
import type { WorkflowNotification } from "../../lib/notifier.js"
import { createTraceAttributes, type HippoTracer } from "../../lib/tracing.js"
import type { WorkflowEngine } from "../../lib/workflow-engine.js"
import type { WorkflowStore } from "../../lib/workflow-store.js"
import type { JsonObject, JsonValue } from "../../types/json.js"

export type WorkflowRouteContext = {
  auth: HippoAuth
  engine: WorkflowEngine
  externalHeartbeatLeaseMs: number
  listenForNotifications?: (
    onNotification: (notification: WorkflowNotification) => void
  ) => Promise<() => Promise<void>>
  metrics: HippoMetrics
  store: WorkflowStore
  tracer: HippoTracer
}

export type ProjectionEntry = { result: JsonValue } | { error: string }

export const renderProjections = (
  queries: Record<string, (context: JsonObject) => JsonValue> | undefined,
  context: JsonObject
): Record<string, ProjectionEntry> => {
  if (!queries) {
    return {}
  }
  const out: Record<string, ProjectionEntry> = {}
  for (const [name, fn] of Object.entries(queries)) {
    try {
      out[name] = { result: fn(context) }
    } catch (error) {
      out[name] = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return out
}

type PaginatedRun = {
  id: string
  updatedAt: Date
}

export const paginateRuns = async <T extends PaginatedRun>(
  query: {
    limit: number
    afterUpdatedAt?: string | undefined
    afterId?: string | undefined
  },
  fetch: (args: {
    limit: number
    afterUpdatedAt?: Date
    afterId?: string
  }) => Promise<T[]>
) => {
  const cursor =
    query.afterUpdatedAt && query.afterId
      ? {
          afterUpdatedAt: new Date(query.afterUpdatedAt),
          afterId: query.afterId,
        }
      : {}
  const rows = await fetch({ limit: query.limit + 1, ...cursor })
  const hasMore = rows.length > query.limit
  const pageRuns = hasMore ? rows.slice(0, query.limit) : rows
  const lastRun = pageRuns.at(-1)
  return {
    runs: pageRuns,
    nextCursor:
      hasMore && lastRun
        ? {
            afterUpdatedAt: lastRun.updatedAt.toISOString(),
            afterId: lastRun.id,
          }
        : null,
  }
}

const projectContextValue = (
  source: JsonObject,
  dottedKey: string
): JsonValue | undefined => {
  const parts = dottedKey.split(".").filter((part) => part.length > 0)
  let current: JsonValue | undefined = source

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined
    }

    current = current[part]
  }

  return current
}

export const projectRunContext = (source: JsonObject, keys: string[]) => {
  if (keys.length === 0) {
    return source
  }

  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = projectContextValue(source, key)
      return value === undefined ? [] : [[key, value]]
    })
  )
}

export const createRouteTraceAttributes = (args: {
  method: string
  operation: string
  route: string
}) => ({
  ...createTraceAttributes({
    operation: args.operation,
  }),
  "http.method": args.method,
  "http.route": args.route,
})

export const requireApiAuth = async (
  app: FastifyInstance,
  request: FastifyRequest,
  auth: HippoAuth,
  tracer?: HippoTracer
) => {
  const verify = () => {
    if (!auth.verifyApiRequest(request)) {
      throw app.httpErrors.unauthorized()
    }
  }

  if (!tracer) {
    verify()
    return
  }

  await tracer.withSpan(
    {
      name: "hippo.http.api_auth",
      attributes: createRouteTraceAttributes({
        method: request.method,
        operation: "http.api_auth",
        route: request.routeOptions.url ?? request.url,
      }),
    },
    async () => {
      verify()
    }
  )
}

export const getIdempotencyKey = (request: FastifyRequest) => {
  const header =
    request.headers["idempotency-key"] ?? request.headers["x-idempotency-key"]

  return typeof header === "string" && header.length > 0 ? header : undefined
}

export const requireCallbackAuth = (
  app: FastifyInstance,
  request: FastifyRequest,
  body: JsonValue,
  auth: HippoAuth
) => {
  if (!auth.verifyCallbackRequest(request, body)) {
    throw app.httpErrors.unauthorized()
  }
}

export const getExistingRun = async (
  app: FastifyInstance,
  store: WorkflowStore,
  runId: string
) => {
  const run = await store.getRun(runId)

  if (!run) {
    throw app.httpErrors.notFound(`Run "${runId}" not found`)
  }

  return run
}

export const propagateCancellation = async (args: {
  mode: "graceful" | "hard"
  reason: string | undefined
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await args.store.requestCancelRun({
      runId: childRun.id,
      mode: args.mode,
      ...(args.reason === undefined ? {} : { reason: args.reason }),
    })

    await propagateCancellation({
      mode: args.mode,
      reason: args.reason,
      runId: childRun.id,
      store: args.store,
    })
  }
}

export const compensateRunTree = async (args: {
  engine: WorkflowEngine
  runId: string
  store: WorkflowStore
}) => {
  const childRuns = await args.store.listChildRuns(args.runId)

  for (const childRun of childRuns) {
    await compensateRunTree({
      engine: args.engine,
      runId: childRun.id,
      store: args.store,
    })
  }

  return args.engine.runCompensation(args.runId)
}

const traceRequest = <T>(
  tracer: HippoTracer,
  input: {
    name: string
    attributes?: Record<string, string | number | boolean>
  },
  run: () => Promise<T>
) => tracer.withSpan(input, run)

export const traceAuthedRequest = <T>(args: {
  app: FastifyInstance
  auth: HippoAuth
  request: FastifyRequest
  tracer: HippoTracer
  trace: {
    name: string
    attributes?: Record<string, string | number | boolean>
  }
  run: () => Promise<T>
}) =>
  traceRequest(args.tracer, args.trace, async () => {
    await requireApiAuth(args.app, args.request, args.auth, args.tracer)
    return args.run()
  })

export const traceRawRequest = traceRequest
