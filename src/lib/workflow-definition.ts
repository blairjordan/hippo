import type { z } from "zod"
import type { JsonValue } from "../types/json.js"
import type {
  ChildStepDefinition,
  FanOutStepDefinition,
  EndStepDefinition,
  ExternalSessionStepDefinition,
  HumanTaskStepDefinition,
  SleepStepDefinition,
  SignalStepDefinition,
  TaskStepDefinition,
  WaitStepDefinition,
  WorkflowDefinition,
  WorkflowStepDefinition,
  TaskStepResult,
  StepExecutionContext,
} from "../types/workflow.js"

export const taskStep = (definition: TaskStepDefinition): TaskStepDefinition =>
  definition

export function task<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny
>(
  definition: Omit<TaskStepDefinition, "kind" | "run"> & {
    input?: TInputSchema
    output?: TOutputSchema
    run: (
      context: Omit<StepExecutionContext, "input"> & {
        input: z.infer<TInputSchema>
      }
    ) =>
      | Promise<
          | z.infer<TOutputSchema>
          | (Omit<TaskStepResult, "output"> & { output?: z.infer<TOutputSchema> })
        >
      | z.infer<TOutputSchema>
      | (Omit<TaskStepResult, "output"> & { output?: z.infer<TOutputSchema> })
  }
): TaskStepDefinition {
  const originalRun = definition.run

  const run = async (context: StepExecutionContext): Promise<TaskStepResult> => {
    let parsedInput: unknown = context.input
    if (definition.input) {
      parsedInput = definition.input.parse(context.input)
    }

    const rawResult = await originalRun({
      ...context,
      input: parsedInput as z.infer<TInputSchema>,
    })

    const isStepResult =
      rawResult !== null &&
      typeof rawResult === "object" &&
      ("patch" in rawResult ||
        "transition" in rawResult ||
        "output" in rawResult ||
        "continueAsNew" in rawResult)

    let finalResult: TaskStepResult
    if (isStepResult) {
      finalResult = rawResult as TaskStepResult
    } else {
      finalResult = { output: rawResult as JsonValue }
    }

    if (definition.output && finalResult.output !== undefined && finalResult.output !== null) {
      finalResult.output = definition.output.parse(finalResult.output) as JsonValue
    }

    return finalResult
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { input, output, ...rest } = definition

  return {
    kind: "task",
    ...rest,
    run,
  } as TaskStepDefinition
}

export const waitStep = (definition: WaitStepDefinition): WaitStepDefinition =>
  definition

export const wait = (
  definition: Omit<WaitStepDefinition, "kind">
): WaitStepDefinition => ({
  kind: "wait",
  ...definition,
})

export const externalSession = (
  definition: Omit<ExternalSessionStepDefinition, "kind">
): ExternalSessionStepDefinition => ({
  kind: "externalSession",
  ...definition,
})

export const signalStep = (
  definition: SignalStepDefinition
): SignalStepDefinition => definition

export const signal = (
  definition: Omit<SignalStepDefinition, "kind">
): SignalStepDefinition => ({
  kind: "signal",
  ...definition,
})

export const humanTaskStep = (
  definition: HumanTaskStepDefinition
): HumanTaskStepDefinition => definition

export const humanTask = (
  definition: Omit<HumanTaskStepDefinition, "kind">
): HumanTaskStepDefinition => ({
  kind: "humanTask",
  ...definition,
})

export const childStep = (
  definition: ChildStepDefinition
): ChildStepDefinition => definition

export const child = (
  definition: Omit<ChildStepDefinition, "kind">
): ChildStepDefinition => ({
  kind: "child",
  ...definition,
})

export const fanOutStep = (
  definition: FanOutStepDefinition
): FanOutStepDefinition => definition

export const fanOut = (
  definition: Omit<FanOutStepDefinition, "kind">
): FanOutStepDefinition => ({
  kind: "fanOut",
  ...definition,
})

export const sleepStep = (
  definition: SleepStepDefinition
): SleepStepDefinition => definition

export const sleep = (
  definition: Omit<SleepStepDefinition, "kind">
): SleepStepDefinition => ({
  kind: "sleep",
  ...definition,
})

export const endStep = (
  definition: Omit<EndStepDefinition, "kind"> = {}
): EndStepDefinition => ({
  kind: "end",
  ...definition,
})

export const end = (
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

    if (step.kind === "fanOut" && step.join?.kind === "quorum" && step.join.count < 1) {
      throw new Error(
        `Workflow "${workflow.name}" step "${stepKey}" quorum count must be at least 1`
      )
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

export const getWorkflowMermaidNodeIds = (workflow: WorkflowDefinition) =>
  Object.fromEntries(
    Object.keys(workflow.steps).map((stepKey, index) => [
      stepKey,
      getNodeId(stepKey, index),
    ])
  )

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
  const nodeIds = new Map(Object.entries(getWorkflowMermaidNodeIds(workflow)))

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

    if (step.kind === "humanTask") {
      lines.push(`  ${nodeId}{{/"${label}"/}}`)
      continue
    }

    if (step.kind === "child") {
      lines.push(`  ${nodeId}[/"${label}"/]`)
      continue
    }

    if (step.kind === "fanOut") {
      lines.push(`  ${nodeId}[\\\\"${label}"//]`)
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
