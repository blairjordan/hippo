import { Client } from "pg"

import type { HippoConfig } from "./config.js"

export type WorkflowNotifier = {
  listen: (
    onNotification: (notification: WorkflowNotification) => void
  ) => Promise<() => Promise<void>>
  notifyRunnable: () => Promise<void>
  notifyRunEvent: (runId: string) => Promise<void>
}

export type WorkflowNotification =
  | { kind: "runnable" }
  | { kind: "run_event"; runId: string }

const parseNotification = (payload: string): WorkflowNotification => {
  if (payload === "runnable") {
    return { kind: "runnable" }
  }

  try {
    const parsed = JSON.parse(payload) as
      | WorkflowNotification
      | { kind?: unknown; runId?: unknown }

    if (parsed.kind === "run_event" && typeof parsed.runId === "string") {
      return { kind: "run_event", runId: parsed.runId }
    }

    if (parsed.kind === "runnable") {
      return { kind: "runnable" }
    }
  } catch {
    return { kind: "runnable" }
  }

  return { kind: "runnable" }
}

export const createWorkflowNotifier = (config: Pick<
  HippoConfig,
  "DATABASE_URL" | "HIPPO_NOTIFICATION_CHANNEL"
>): WorkflowNotifier => {
  const notify = async (notification: WorkflowNotification) => {
    const client = new Client({
      connectionString: config.DATABASE_URL,
    })

    await client.connect()

    try {
      await client.query("SELECT pg_notify($1, $2)", [
        config.HIPPO_NOTIFICATION_CHANNEL,
        JSON.stringify(notification),
      ])
    } finally {
      await client.end()
    }
  }

  const notifyRunnable = async () => notify({ kind: "runnable" })

  const notifyRunEvent = async (runId: string) =>
    notify({ kind: "run_event", runId })

  const listen = async (
    onNotification: (notification: WorkflowNotification) => void
  ) => {
    const client = new Client({
      connectionString: config.DATABASE_URL,
    })

    await client.connect()
    client.on("notification", (message) => {
      onNotification(parseNotification(message.payload ?? "runnable"))
    })
    await client.query(`LISTEN ${config.HIPPO_NOTIFICATION_CHANNEL}`)

    return async () => {
      client.removeAllListeners("notification")
      await client.end()
    }
  }

  return {
    listen,
    notifyRunnable,
    notifyRunEvent,
  }
}
