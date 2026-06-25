import { describe, expect, it } from "vitest"

import { createMetrics, LostLeaseError } from "./core.js"
import { defineWorkflow, endStep, renderWorkflowAsMermaid } from "./sdk.js"
import { createApiAuthenticator, signCallbackBody } from "./server.js"

describe("public api surfaces", () => {
  it("exposes sdk builders and render helpers", () => {
    const workflow = defineWorkflow({
      name: "public-api-demo",
      version: 1,
      startAt: "done",
      steps: {
        done: endStep({
          label: "Completed",
        }),
      },
    })

    expect(renderWorkflowAsMermaid(workflow)).toContain("flowchart TD")
  })

  it("exposes core utilities", () => {
    const metrics = createMetrics()

    expect(metrics.registry).toBeDefined()
    expect(new LostLeaseError()).toBeInstanceOf(Error)
  })

  it("exposes server auth helpers", () => {
    const verifyApiRequest = createApiAuthenticator("demo-token")
    const signature = signCallbackBody({
      body: { ok: true },
      secret: "secret",
      timestamp: "123",
    })

    expect(
      verifyApiRequest({
        headers: {
          authorization: "Bearer demo-token",
        },
      } as never)
    ).toBe(true)
    expect(signature).toMatch(/^[a-f0-9]{64}$/u)
  })
})
