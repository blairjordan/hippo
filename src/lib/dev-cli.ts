import { readFile } from "node:fs/promises"
import net from "node:net"

import type { HippoProcessRole } from "./process-role.js"

export type DevCommandStep = {
  kind: "setup" | "serve"
  command: string
  args: string[]
  env?: Record<string, string>
}

export const defaultLocalDatabaseUrl =
  "postgres://postgres:postgres@127.0.0.1:55432/hippo?sslmode=disable"

export const parseEnvFileContent = (content: string) =>
  Object.fromEntries(
    content
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .flatMap((line) => {
        const separatorIndex = line.indexOf("=")

        if (separatorIndex <= 0) {
          return []
        }

        const key = line.slice(0, separatorIndex).trim()
        const value = line.slice(separatorIndex + 1).trim()

        return key.length === 0 ? [] : [[key, value]]
      })
  )

export const readEnvFile = async (path: string) => {
  try {
    return parseEnvFileContent(await readFile(path, "utf8"))
  } catch (error) {
    const asNodeError = error as NodeJS.ErrnoException

    if (asNodeError.code === "ENOENT") {
      return {}
    }

    throw error
  }
}

export const getNpmCommand = (platform: NodeJS.Platform) =>
  platform === "win32" ? "npm.cmd" : "npm"

export const createHippoDevPlan = (args: {
  platform: NodeJS.Platform
  role?: HippoProcessRole
}) =>
  [
    {
      kind: "setup",
      command: "docker",
      args: ["compose", "up", "-d", "postgres"],
    },
    {
      kind: "setup",
      command: getNpmCommand(args.platform),
      args: ["run", "db:migrate"],
    },
    {
      kind: "serve",
      command: "npx",
      args: ["tsx", "src/index.ts"],
      ...(args.role === undefined || args.role === "all"
        ? {}
        : { env: { HIPPO_ROLE: args.role } }),
    },
  ] as const satisfies readonly DevCommandStep[]

export const resolveDatabaseAddress = (args: {
  env: Record<string, string | undefined>
}) => {
  const databaseUrl = args.env.DATABASE_URL ?? defaultLocalDatabaseUrl
  const parsed = new URL(databaseUrl)

  return {
    host: parsed.hostname || "127.0.0.1",
    port:
      parsed.port.length > 0 ? Number(parsed.port) : parsed.protocol === "postgresql:" ? 5432 : 5432,
  }
}

const sleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs)
  })

const tryConnect = (args: { host: string; port: number; timeoutMs: number }) =>
  new Promise<boolean>((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (value: boolean) => {
      if (settled) {
        return
      }

      settled = true
      socket.destroy()
      resolve(value)
    }

    socket.setTimeout(args.timeoutMs)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
    socket.connect(args.port, args.host)
  })

export const waitForPort = async (args: {
  host: string
  port: number
  timeoutMs: number
  retryDelayMs: number
  tryConnect?: (args: {
    host: string
    port: number
    timeoutMs: number
  }) => Promise<boolean>
}) => {
  const deadline = Date.now() + args.timeoutMs

  while (Date.now() < deadline) {
    const connected = await (args.tryConnect ?? tryConnect)({
      host: args.host,
      port: args.port,
      timeoutMs: Math.min(args.retryDelayMs, 1_000),
    })

    if (connected) {
      return
    }

    await sleep(args.retryDelayMs)
  }

  throw new Error(
    `Timed out waiting for ${args.host}:${String(args.port)} to accept TCP connections`
  )
}
