import type {
  EndStepDefinition,
  SleepStepDefinition,
  TaskStepDefinition,
  WaitStepDefinition,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "../types/workflow.js"

export const taskStep = (definition: TaskStepDefinition): TaskStepDefinition =>
  definition

export const waitStep = (definition: WaitStepDefinition): WaitStepDefinition =>
  definition

export const sleepStep = (
  definition: SleepStepDefinition
): SleepStepDefinition => definition

export const endStep = (
  definition: Omit<EndStepDefinition, "kind"> = {}
): EndStepDefinition => ({
  kind: "end",
  ...definition,
})

const getStaticTargets = (step: WorkflowStepDefinition) => {
  const targets = new Set<string>()

  if ("next" in step && typeof step.next === "string") {
    targets.add(step.next)
  }

  if ("transitions" in step && step.transitions) {
    for (const target of Object.values(step.transitions)) {
      targets.add(target)
    }
  }

  return [...targets]
}

const validateWorkflowDefinition = (workflow: WorkflowDefinition) => {
  if (!workflow.steps[workflow.startAt]) {
    throw new Error(
      `Workflow "${workflow.name}" start step "${workflow.startAt}" is missing`
    )
  }

  for (const [stepKey, step] of Object.entries(workflow.steps)) {
    for (const target of getStaticTargets(step)) {
      if (!workflow.steps[target]) {
        throw new Error(
          `Workflow "${workflow.name}" step "${stepKey}" references missing target "${target}"`
        )
      }
    }

    if (step.kind !== "end" && step.kind !== "sleep") {
      if (!step.next && !step.transitions) {
        throw new Error(
          `Workflow "${workflow.name}" step "${stepKey}" must define next or transitions`
        )
      }
    }
  }
}

export const defineWorkflow = (definition: WorkflowDefinition): WorkflowDefinition => {
  validateWorkflowDefinition(definition)
  return definition
}

const formatLabel = (workflow: WorkflowDefinition, stepKey: string) => {
  const step = workflow.steps[stepKey]
  if (!step) {
    return stepKey
  }

  return step.label ?? `${stepKey}\\n(${step.kind})`
}

const getEdges = (workflow: WorkflowDefinition) =>
  Object.entries(workflow.steps).flatMap(([stepKey, step]) =>
    getStaticTargets(step).map((to) => ({ from: stepKey, to }))
  )

export const renderWorkflowAsMermaid = (workflow: WorkflowDefinition) => {
  const lines = ["flowchart TD"]

  for (const [stepKey, step] of Object.entries(workflow.steps)) {
    const label = formatLabel(workflow, stepKey)

    if (step.kind === "end") {
      lines.push(`  ${stepKey}(["${label}"])`)
      continue
    }

    if (step.kind === "wait") {
      lines.push(`  ${stepKey}{{"${label}"}}`)
      continue
    }

    if (step.kind === "sleep") {
      lines.push(`  ${stepKey}[[\"${label}\"]]`)
      continue
    }

    lines.push(`  ${stepKey}["${label}"]`)
  }

  for (const edge of getEdges(workflow)) {
    lines.push(`  ${edge.from} --> ${edge.to}`)
  }

  return lines.join("\n")
}
