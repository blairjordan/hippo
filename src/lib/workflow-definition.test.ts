import { describe, expect, it } from "vitest"

import { defineWorkflow, renderWorkflowAsMermaid, taskStep } from "./workflow-definition.js"
import { demoWorkflow } from "../workflows/demo.js"

describe("workflow rendering", () => {
  it("renders mermaid output", () => {
    const output = renderWorkflowAsMermaid(demoWorkflow)

    expect(output).toContain("flowchart TD")
    expect(output).toContain("classify-recipient")
    expect(output).toContain("delivery-confirmation")
    expect(output).toContain("classify-recipient --> send-email")
    expect(output).toContain("classify-recipient --> send-sms")
    expect(output).toContain("classify-recipient --> send-webhook")
  })

  it("rejects workflows with missing step targets", () => {
    expect(() =>
      defineWorkflow({
        name: "broken",
        version: 1,
        startAt: "start",
        steps: {
          start: taskStep({
            kind: "task",
            next: "missing",
            run: () => ({}),
          }),
        },
      })
    ).toThrow('references missing target "missing"')
  })
})
