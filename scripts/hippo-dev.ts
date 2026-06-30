import { spawn } from "node:child_process"

import {
  createHippoDevPlan,
  readEnvFile,
  resolveDatabaseAddress,
  waitForPort,
} from "../src/lib/dev-cli.js"

const runStep = (args: {
  command: string
  args: string[]
  env?: Record<string, string>
}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(args.command, args.args, {
      env: { ...process.env, ...(args.env ?? {}) },
      stdio: "inherit",
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `Command "${args.command} ${args.args.join(" ")}" exited with ${
            signal ? `signal ${signal}` : `code ${String(code ?? "unknown")}`
          }`
        )
      )
    })
  })

const runServeStep = (args: {
  command: string
  args: string[]
  env?: Record<string, string>
}) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(args.command, args.args, {
      env: { ...process.env, ...(args.env ?? {}) },
      stdio: "inherit",
    })

    const forwardSignal = (signal: NodeJS.Signals) => {
      child.kill(signal)
    }

    process.once("SIGINT", forwardSignal)
    process.once("SIGTERM", forwardSignal)

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", forwardSignal)
      process.removeListener("SIGTERM", forwardSignal)

      if (code === 0) {
        resolve()
        return
      }

      reject(
        new Error(
          `Serve command "${args.command} ${args.args.join(" ")}" exited with ${
            signal ? `signal ${signal}` : `code ${String(code ?? "unknown")}`
          }`
        )
      )
    })
  })

const main = async () => {
  const plan = createHippoDevPlan({ platform: process.platform })
  const fileEnv = await readEnvFile(".env")
  Object.assign(process.env, fileEnv)
  const databaseAddress = resolveDatabaseAddress({
    env: process.env,
  })

  for (const step of plan) {
    if (step.kind === "serve") {
      await runServeStep(step)
      return
    }

    await runStep(step)

    if (step.command === "docker" && step.args.join(" ") === "compose up -d postgres") {
      await waitForPort({
        host: databaseAddress.host,
        port: databaseAddress.port,
        timeoutMs: 30_000,
        retryDelayMs: 250,
      })
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
