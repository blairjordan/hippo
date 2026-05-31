import type { FastifyPluginAsync } from "fastify"

export const createHealthRoutes = (check: () => Promise<boolean>): FastifyPluginAsync =>
  async (app) => {
    app.get("/healthz", async (_request, reply) => {
      const ok = await check()

      reply.code(ok ? 200 : 503)
      return { status: ok ? "pass" : "fail" }
    })
  }
