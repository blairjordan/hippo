import { Command } from "commander"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

import { computeNextScheduleFireAt } from "./lib/scheduler.js"

import {
  createDefaultCliDeps,
  defaultWorkflowPath,
  resolveWorkflowModuleUrl,
  runStoreCommand,
  type CliDeps,
} from "./lib/cli-deps.js"
import type { HippoProcessRole } from "./lib/process-role.js"
import type {
  WorkflowRunStatus,
} from "./types/workflow.js"

export const createHippoCli = (inputDeps: Partial<CliDeps> = {}) => {
  const deps = {
    ...createDefaultCliDeps(),
    ...inputDeps,
  } satisfies CliDeps
  const program = new Command()

  program
    .name("hippo")
    .description("Hippo command-line interface")
    .version("0.1.0")

  program
    .command("migrate")
    .description("Apply database migrations to Postgres")
    .option("--database-url <url>", "PostgreSQL connection URL")
    .action(async (options: { databaseUrl?: string }) => {
      const databaseUrl = options.databaseUrl ?? deps.env.DATABASE_URL

      if (!databaseUrl) {
        deps.stderr.error(
          "Error: Database URL is required. Provide --database-url or set DATABASE_URL."
        )
        deps.exit(1)
        throw new Error("unreachable")
      }

      try {
        await deps.runMigrations(databaseUrl)
        deps.stdout.log("Migrations applied successfully.")
      } catch (error) {
        deps.stderr.error("Migration failed:", error)
        deps.exit(1)
      }
    })

  const addRenderCommand = (command: Command) => {
    command
      .command("render <workflowName>")
      .description("Render a workflow definition as Mermaid diagram")
      .option(
        "--workflows <path>",
        "Path to the workflows index file",
        defaultWorkflowPath
      )
      .action(
        async (workflowName: string, options: { workflows?: string }) => {
          const workflowsPath = path.resolve(
            deps.cwd(),
            options.workflows ?? defaultWorkflowPath
          )

          try {
            const definitions = await deps.loadWorkflowDefinitions(
              pathToFileURL(workflowsPath)
            )
            const definition = definitions.find(
              (candidate) => candidate.name === workflowName
            )

            if (!definition) {
              deps.stderr.error(
                `Error: Workflow "${workflowName}" not found in ${workflowsPath}`
              )
              deps.exit(1)
              throw new Error("unreachable")
            }

            deps.stdout.log(deps.renderWorkflowAsMermaid(definition))
          } catch (error) {
            deps.stderr.error("Failed to render workflow:", error)
            deps.exit(1)
          }
        }
      )
  }

  addRenderCommand(program)

  const addRoleCommand = (args: {
    name: string
    role: HippoProcessRole
    description: string
    alias?: string
  }) => {
    const command = program.command(args.name).description(args.description)

    if (args.alias) {
      command.alias(args.alias)
    }

    command
      .option(
        "--workflows <path>",
        "Path to the workflows index file",
        defaultWorkflowPath
      )
      .action(async (options: { workflows?: string }) => {
        try {
          await deps.runProcessRole({
            role: args.role,
            workflowsPath: options.workflows ?? defaultWorkflowPath,
          })
        } catch (error) {
          deps.stderr.error(`Failed to start Hippo '${args.role}' role:`, error)
          deps.exit(1)
        }
      })
  }

  addRoleCommand({
    name: "serve",
    role: "serve",
    description: "Start only the API server and dashboard",
  })
  addRoleCommand({
    name: "work",
    role: "work",
    description: "Start only background execution loops",
    alias: "worker",
  })
  addRoleCommand({
    name: "all",
    role: "all",
    description: "Start both the API server and background loops",
    alias: "server",
  })

  const runsCmd = program
    .command("runs")
    .description("Manage and query workflow runs")

  runsCmd
    .command("list")
    .alias("ls")
    .description("List workflow runs with optional filters")
    .option("--limit <number>", "Maximum number of runs to list", "50")
    .option("--status <status>", "Filter runs by status")
    .option("--workflow <name>", "Filter runs by workflow name")
    .option("--search <query>", "Search query for run ID, definition name or step key")
    .option("--metadata <pairs...>", "Filter runs by metadata key=value pairs (e.g. env=production)")
    .action(
      async (options: {
        limit: string
        status?: string
        workflow?: string
        search?: string
        metadata?: string[]
      }) => {
        try {
          await runStoreCommand(deps, async (store) => {
            const metadataFilter: Record<string, string | number | boolean> = {}
            if (options.metadata) {
              for (const pair of options.metadata) {
                const idx = pair.indexOf("=")
                if (idx !== -1) {
                  const key = pair.slice(0, idx).trim()
                  const valStr = pair.slice(idx + 1).trim()
                  let val: string | number | boolean = valStr
                  if (valStr === "true") val = true
                  else if (valStr === "false") val = false
                  else if (!isNaN(Number(valStr)) && valStr !== "") val = Number(valStr)
                  metadataFilter[key] = val
                }
              }
            }

            const runs = await store.listRunsPaginated({
              limit: parseInt(options.limit, 10),
              ...(options.status
                ? { statuses: [options.status as WorkflowRunStatus] }
                : {}),
              ...(options.workflow ? { workflowName: options.workflow } : {}),
              ...(options.search ? { search: options.search } : {}),
              ...(Object.keys(metadataFilter).length > 0
                ? { metadata: metadataFilter }
                : {}),
            })

            if (runs.length === 0) {
              deps.stdout.log("No runs found.")
              return
            }

            deps.stdout.log(
              `${"RUN ID".padEnd(36)} | ${"WORKFLOW".padEnd(20)} | ${"STATUS".padEnd(10)} | ${"CURRENT STEP".padEnd(20)} | UPDATED AT`
            )
            deps.stdout.log("-".repeat(105))

            for (const run of runs) {
              deps.stdout.log(
                `${run.id} | ${run.definitionName.padEnd(20).slice(0, 20)} | ${run.status.padEnd(10)} | ${(run.currentStepKey ?? "done").padEnd(20).slice(0, 20)} | ${run.updatedAt.toLocaleString()}`
              )
            }
          })
        } catch (error) {
          deps.stderr.error("Failed to list runs:", error)
          deps.exit(1)
        }
      }
    )

  runsCmd
    .command("show <runId>")
    .description("Inspect a specific workflow run in detail")
    .action(async (runId: string) => {
      try {
        await runStoreCommand(deps, async (store) => {
          const run = await store.getRun(runId)

          if (!run) {
            deps.stderr.error(`Error: Run "${runId}" not found.`)
            deps.exit(1)
            throw new Error("unreachable")
          }

          deps.stdout.log("Run Details:")
          deps.stdout.log(`  ID:                 ${run.id}`)
          deps.stdout.log(`  Workflow:           ${run.definitionName} (v${run.definitionVersion})`)
          deps.stdout.log(`  Status:             ${run.status}`)
          deps.stdout.log(`  Task Queue:         ${run.taskQueue}`)
          deps.stdout.log(`  Priority:           ${run.priority}`)
          deps.stdout.log(`  Current Step:       ${run.currentStepKey ?? "Completed"}`)
          deps.stdout.log(`  Lease Owner:        ${run.leaseOwner ?? "None"}`)
          deps.stdout.log(`  Lease Expires:      ${run.leaseExpiresAt ? run.leaseExpiresAt.toLocaleString() : "N/A"}`)
          deps.stdout.log(`  Available At:       ${run.availableAt.toLocaleString()}`)
          deps.stdout.log(`  Created At:         ${run.createdAt.toLocaleString()}`)
          deps.stdout.log(`  Updated At:         ${run.updatedAt.toLocaleString()}`)

          if (run.completedAt) {
            deps.stdout.log(`  Completed At:       ${run.completedAt.toLocaleString()}`)
          }

          if (run.parentRunId) {
            deps.stdout.log(`  Parent Run ID:      ${run.parentRunId} (Step: ${run.parentStepKey})`)
          }

          if (run.traceContext) {
            deps.stdout.log(`  Trace Context:      ${run.traceContext}`)
          }

          deps.stdout.log("\nInput:")
          deps.stdout.log(JSON.stringify(run.input, null, 2))
          deps.stdout.log("\nContext:")
          deps.stdout.log(JSON.stringify(run.context, null, 2))

          if (run.result) {
            deps.stdout.log("\nResult:")
            deps.stdout.log(JSON.stringify(run.result, null, 2))
          }

          if (run.error) {
            deps.stdout.log("\nError:")
            deps.stdout.log(JSON.stringify(run.error, null, 2))
          }

          const attempts = await store.getRunAttempts(runId)

          if (attempts.length === 0) {
            return
          }

          deps.stdout.log("\nStep Attempts:")
          deps.stdout.log(
            `${"  STEP".padEnd(25)} | ${"KIND".padEnd(12)} | ${"ATTEMPT".padEnd(8)} | ${"STATUS".padEnd(10)} | COMPLETED AT`
          )
          deps.stdout.log(`  ${"-".repeat(70)}`)

          for (const attempt of attempts) {
            deps.stdout.log(
              `  ${attempt.stepKey.padEnd(23).slice(0, 23)} | ${attempt.kind.padEnd(10)} | ${String(attempt.attempt).padEnd(6)} | ${attempt.status.padEnd(8)} | ${attempt.completedAt ? attempt.completedAt.toLocaleString() : "in-progress"}`
            )
          }
        })
      } catch (error) {
        deps.stderr.error("Failed to inspect run:", error)
        deps.exit(1)
      }
    })

  runsCmd
    .command("cancel <runId>")
    .description("Request cancellation of a workflow run")
    .option("--mode <mode>", "Cancel mode: graceful or hard", "graceful")
    .action(async (runId: string, options: { mode: string }) => {
      try {
        await runStoreCommand(deps, async (store) => {
          const run = await store.getRun(runId)

          if (!run) {
            deps.stderr.error(`Error: Run "${runId}" not found.`)
            deps.exit(1)
          }

          const mode = options.mode === "hard" ? "hard" : "graceful"
          await store.requestCancelRun({ runId, mode })
          deps.stdout.log(`Cancellation request ('${mode}') submitted for run ${runId}.`)
        })
      } catch (error) {
        deps.stderr.error("Failed to cancel run:", error)
        deps.exit(1)
      }
    })

  const workflowsCmd = program
    .command("workflows")
    .description("Query and render workflows")

  workflowsCmd
    .command("list")
    .alias("ls")
    .description("List all loaded workflow definitions")
    .option(
      "--workflows <path>",
      "Path to the workflows index file",
      defaultWorkflowPath
    )
    .action(async (options: { workflows?: string }) => {
      try {
        const definitions = await deps.loadWorkflowDefinitions(
          resolveWorkflowModuleUrl({
            cwd: deps.cwd(),
            workflowsPath: options.workflows ?? defaultWorkflowPath,
          })
        )

        if (definitions.length === 0) {
          deps.stdout.log("No workflows registered.")
          return
        }

        deps.stdout.log("Registered Workflows:")

        for (const definition of definitions) {
          deps.stdout.log(
            `- ${definition.name} (version: ${definition.version})${definition.title ? `: ${definition.title}` : ""}`
          )
        }
      } catch (error) {
        deps.stderr.error("Failed to list workflows:", error)
        deps.exit(1)
      }
    })

  addRenderCommand(workflowsCmd)

  const schedulesCmd = program
    .command("schedules")
    .description("Manage cron schedules")

  schedulesCmd
    .command("list")
    .alias("ls")
    .description("List all schedules")
    .action(async () => {
      try {
        await runStoreCommand(deps, async (store) => {
          const list = await store.listSchedules()

          if (list.length === 0) {
            deps.stdout.log("No schedules registered.")
            return
          }

          deps.stdout.log(
            `${"SCHEDULE ID".padEnd(36)} | ${"WORKFLOW".padEnd(20)} | ${"CRON".padEnd(15)} | ${"ACTIVE".padEnd(6)} | NEXT FIRE`
          )
          deps.stdout.log("-".repeat(105))

          for (const s of list) {
            deps.stdout.log(
              `${s.id} | ${s.workflowName.padEnd(20).slice(0, 20)} | ${s.cronExpression.padEnd(15).slice(0, 15)} | ${String(s.active).padEnd(6)} | ${s.nextFireAt.toLocaleString()}`
            )
          }
        })
      } catch (error) {
        deps.stderr.error("Failed to list schedules:", error)
        deps.exit(1)
      }
    })

  schedulesCmd
    .command("create")
    .description("Create a new cron schedule")
    .requiredOption("--workflow <name>", "Name of the workflow to run")
    .requiredOption("--cron <expr>", "Cron expression")
    .option("--queue <queue>", "Task queue", "default")
    .option("--priority <number>", "Priority", "0")
    .option("--payload <json>", "JSON payload", "{}")
    .action(
      async (options: {
        workflow: string
        cron: string
        queue: string
        priority: string
        payload: string
      }) => {
        try {
          let parsedPayload = {}
          try {
            parsedPayload = JSON.parse(options.payload)
          } catch {
            deps.stderr.error("Error: --payload must be a valid JSON string.")
            deps.exit(1)
            throw new Error("unreachable")
          }

          const nextFireAt = computeNextScheduleFireAt({
            cronExpression: options.cron,
          })

          await runStoreCommand(deps, async (store) => {
            const schedule = await store.createSchedule({
              workflowName: options.workflow,
              cronExpression: options.cron,
              payload: parsedPayload,
              taskQueue: options.queue,
              priority: parseInt(options.priority, 10),
              nextFireAt,
            })

            deps.stdout.log(`Schedule created successfully with ID: ${schedule.id}`)
          })
        } catch (error) {
          deps.stderr.error("Failed to create schedule:", error)
          deps.exit(1)
        }
      }
    )

  schedulesCmd
    .command("pause <scheduleId>")
    .description("Pause a cron schedule")
    .action(async (scheduleId: string) => {
      try {
        await runStoreCommand(deps, async (store) => {
          const list = await store.listSchedules()
          const schedule = list.find((s) => s.id === scheduleId)
          if (!schedule) {
            deps.stderr.error(`Error: Schedule "${scheduleId}" not found.`)
            deps.exit(1)
            throw new Error("unreachable")
          }

          await store.updateScheduleActive({
            id: scheduleId,
            active: false,
            nextFireAt: schedule.nextFireAt,
          })
          deps.stdout.log(`Schedule ${scheduleId} paused.`)
        })
      } catch (error) {
        deps.stderr.error("Failed to pause schedule:", error)
        deps.exit(1)
      }
    })

  schedulesCmd
    .command("resume <scheduleId>")
    .description("Resume a paused cron schedule")
    .action(async (scheduleId: string) => {
      try {
        await runStoreCommand(deps, async (store) => {
          const list = await store.listSchedules()
          const schedule = list.find((s) => s.id === scheduleId)
          if (!schedule) {
            deps.stderr.error(`Error: Schedule "${scheduleId}" not found.`)
            deps.exit(1)
            throw new Error("unreachable")
          }

          const nextFireAt = computeNextScheduleFireAt({
            cronExpression: schedule.cronExpression,
          })

          await store.updateScheduleActive({
            id: scheduleId,
            active: true,
            nextFireAt,
          })
          deps.stdout.log(`Schedule ${scheduleId} resumed.`)
        })
      } catch (error) {
        deps.stderr.error("Failed to resume schedule:", error)
        deps.exit(1)
      }
    })

  schedulesCmd
    .command("delete <scheduleId>")
    .alias("rm")
    .description("Delete a cron schedule")
    .action(async (scheduleId: string) => {
      try {
        await runStoreCommand(deps, async (store) => {
          await store.deleteSchedule(scheduleId)
          deps.stdout.log(`Schedule ${scheduleId} deleted.`)
        })
      } catch (error) {
        deps.stderr.error("Failed to delete schedule:", error)
        deps.exit(1)
      }
    })

  return program
}

export const runHippoCli = async (argv = process.argv) => {
  await createHippoCli().parseAsync(argv)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runHippoCli()
}
