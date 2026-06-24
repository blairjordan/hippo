import type { FastifyPluginAsync, FastifyRequest } from "fastify"

import type { HippoMetrics } from "../lib/metrics.js"

export const createMetricsRoutes = (
  metrics: HippoMetrics,
  verifyApiRequest: (request: FastifyRequest) => boolean
): FastifyPluginAsync => async (app) => {
  app.get("/metrics", async (_request, reply) => {
    if (!verifyApiRequest(_request)) {
      throw app.httpErrors.unauthorized()
    }

    reply.header("content-type", metrics.registry.contentType)
    return metrics.registry.metrics()
  })
}
