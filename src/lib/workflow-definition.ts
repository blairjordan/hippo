import type {
  ChildStepDefinition,
  EndStepDefinition,
  SleepStepDefinition,
  SignalStepDefinition,
  TaskStepDefinition,
  WaitStepDefinition,
  WorkflowDefinition,
  WorkflowStepDefinition,
} from "../types/workflow.js"

export const taskStep = (definition: TaskStepDefinition): TaskStepDefinition =>
  definition

export const waitStep = (definition: WaitStepDefinition): WaitStepDefinition =>
  definition

export const signalStep = (
  definition: SignalStepDefinition
): SignalStepDefinition => definition

export const childStep = (
  definition: ChildStepDefinition
): ChildStepDefinition => definition

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

const getNodeId = (stepKey: string, index: number) =>
  `step_${String(index)}_${stepKey.replaceAll(/[^a-zA-Z0-9_]/g, "_")}`

const getEdges = (workflow: WorkflowDefinition) =>
  Object.entries(workflow.steps).flatMap(([stepKey, step]) =>
    getStaticTargets(step).map((to) => ({ from: stepKey, to }))
  )

export const renderWorkflowAsMermaid = (
  workflow: WorkflowDefinition,
  options: {
    highlightedStepKey?: string
  } = {}
) => {
  const lines = ["flowchart TD"]
  const nodeIds = new Map(
    Object.keys(workflow.steps).map((stepKey, index) => [
      stepKey,
      getNodeId(stepKey, index),
    ])
  )

  for (const [stepKey, step] of Object.entries(workflow.steps)) {
    const label = formatLabel(workflow, stepKey)
    const nodeId = nodeIds.get(stepKey)

    if (!nodeId) {
      throw new Error(`Workflow "${workflow.name}" is missing node id for "${stepKey}"`)
    }

    if (step.kind === "end") {
      lines.push(`  ${nodeId}(["${label}"])`)
      continue
    }

    if (step.kind === "wait") {
      lines.push(`  ${nodeId}{{"${label}"}}`)
      continue
    }

    if (step.kind === "signal") {
      lines.push(`  ${nodeId}{{"${label}"}}`)
      continue
    }

    if (step.kind === "child") {
      lines.push(`  ${nodeId}[/"${label}"/]`)
      continue
    }

    if (step.kind === "sleep") {
      lines.push(`  ${nodeId}[["${label}"]]`)
      continue
    }

    lines.push(`  ${nodeId}["${label}"]`)
  }

  for (const edge of getEdges(workflow)) {
    const from = nodeIds.get(edge.from)
    const to = nodeIds.get(edge.to)

    if (!from || !to) {
      throw new Error(
        `Workflow "${workflow.name}" is missing node ids for edge "${edge.from}" -> "${edge.to}"`
      )
    }

    lines.push(`  ${from} --> ${to}`)
  }

  if (options.highlightedStepKey) {
    const highlightedNodeId = nodeIds.get(options.highlightedStepKey)

    if (highlightedNodeId) {
      lines.push(`  class ${highlightedNodeId} currentStep`)
    }
  }

  lines.push("  classDef currentStep fill:#c6f6d5,stroke:#14532d,stroke-width:4px,color:#14532d")

  return lines.join("\n")
}
