import { describe, expect, it } from "vitest"

import { defineWorkflow, renderWorkflowAsMermaid, taskStep } from "./workflow-definition.js"
import { demoWorkflow } from "../workflows/demo.js"

describe("workflow rendering", () => {
  it("renders mermaid output", () => {
    const output = renderWorkflowAsMermaid(demoWorkflow)

    expect(output).toContain("flowchart TD")
    expect(output).toContain("Classify recipient")
    expect(output).toContain("Wait for provider callback")
    expect(output).toContain("step_0_classify_recipient --> step_1_send_email")
    expect(output).toContain("step_0_classify_recipient --> step_2_send_sms")
    expect(output).toContain("step_0_classify_recipient --> step_3_send_webhook")
  })

  it("highlights the current step with a Mermaid class", () => {
    const output = renderWorkflowAsMermaid(demoWorkflow, {
      highlightedStepKey: "delivery-confirmation",
    })

    expect(output).toContain("class step_5_delivery_confirmation currentStep")
    expect(output).toContain("classDef currentStep")
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
