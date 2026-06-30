import { describe, expect, it, vi } from "vitest"

import { getConfig } from "./config.js"

const withEnv = async (
  env: Record<string, string | undefined>,
  run: () => void | Promise<void>
) => {
  const previous = { ...process.env }

  vi.stubEnv("DATABASE_URL", env.DATABASE_URL ?? "")

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key]
      continue
    }

    process.env[key] = value
  }

  try {
    await run()
  } finally {
    process.env = previous
    vi.unstubAllEnvs()
  }
}

describe("config", () => {
  it("defaults HIPPO_ENV to dev", async () => {
    await withEnv(
      {
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/hippo",
        HIPPO_ENV: undefined,
      },
      async () => {
        expect(getConfig().HIPPO_ENV).toBe("dev")
        expect(getConfig().HIPPO_ROLE).toBe("all")
      }
    )
  })

  it("parses explicit process roles", async () => {
    await withEnv(
      {
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/hippo",
        HIPPO_ROLE: "work",
      },
      async () => {
        expect(getConfig().HIPPO_ROLE).toBe("work")
      }
    )
  })

  it("allows missing auth secrets in dev", async () => {
    await withEnv(
      {
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/hippo",
        HIPPO_ENV: "dev",
        HIPPO_API_TOKEN: undefined,
        HIPPO_CALLBACK_SECRET: undefined,
      },
      async () => {
        expect(() => getConfig()).not.toThrow()
      }
    )
  })

  it("requires auth secrets outside dev", async () => {
    await withEnv(
      {
        DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/hippo",
        HIPPO_ENV: "prod",
        HIPPO_API_TOKEN: undefined,
        HIPPO_CALLBACK_SECRET: undefined,
      },
      async () => {
        expect(() => getConfig()).toThrow(/HIPPO_API_TOKEN/)
      }
    )
  })
})
