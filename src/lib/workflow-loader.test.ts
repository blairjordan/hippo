import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import {
  loadWorkflowDefinitions,
  startWorkflowDevReloader,
} from "./workflow-loader.js"

const tempDirectories: string[] = []

const createWorkflowModule = async (source: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), "hippo-workflow-loader-"))
  const filePath = path.join(directory, "index.mjs")
  tempDirectories.push(directory)
  await writeFile(filePath, source, "utf8")
  return pathToFileURL(filePath)
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  )
})

describe("workflow loader", () => {
  it("loads workflow arrays from a module export", async () => {
    const modulePath = await createWorkflowModule(`
      export const workflows = [
        {
          name: "loaded",
          version: 1,
          startAt: "done",
          steps: {
            done: { kind: "end", label: "Done" }
          }
        }
      ]
    `)

    const workflows = await loadWorkflowDefinitions(modulePath)

    expect(workflows).toHaveLength(1)
    expect(workflows[0]?.name).toBe("loaded")
  })

  it("rejects modules without a workflows array export", async () => {
    const modulePath = await createWorkflowModule(`export const workflows = { nope: true }`)

    await expect(loadWorkflowDefinitions(modulePath)).rejects.toThrow(
      'must export a "workflows" array'
    )
  })

  it("debounces workflow reload notifications and stops cleanly", async () => {
    let listener: (() => void) | undefined
    const replaceDefinitionsCalls: unknown[] = []
    const stop = await startWorkflowDevReloader({
      debounceMs: 5,
      engine: {
        async cancelExternalSessionsForRun() {
          return { attempted: 0 }
        },
        getWorkflow() {
          throw new Error("not used")
        },
        hasWorkflow() {
          return true
        },
        listWorkflows() {
          return []
        },
        listWorkflowVersions() {
          return []
        },
        replaceDefinitions(definitions) {
          replaceDefinitionsCalls.push(definitions)
          return []
        },
        async resumeWait() {
          throw new Error("not used")
        },
        async resumeHumanTask() {
          throw new Error("not used")
        },
        async resumeExternalSession() {
          throw new Error("not used")
        },
        async runCompensation() {
          return null
        },
        async startRun() {
          throw new Error("not used")
        },
        async tick() {
          return null
        },
      },
      loadDefinitions: async () => [
        {
          name: "loaded",
          version: 1,
          startAt: "done",
          steps: {
            done: { kind: "end", label: "Done" },
          },
        },
      ],
      logger: {
        error: () => undefined,
        info: () => undefined,
      },
      modulePath: new URL("file:///tmp/workflows/index.mjs"),
      watchImpl: (_watchPath, nextListener) => {
        listener = nextListener
        return {
          close: () => undefined,
        }
      },
    })

    listener?.()
    listener?.()
    listener?.()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(replaceDefinitionsCalls).toHaveLength(1)

    await stop()
    listener?.()
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(replaceDefinitionsCalls).toHaveLength(1)
  })

  it("uses the dev reloader symlink copy strategy when HIPPO_ENV is dev", async () => {
    // Setup a temp workspace
    const tempDir = await mkdtemp(path.join(tmpdir(), "hippo-dev-loader-workspace-"))
    tempDirectories.push(tempDir)

    // Create folders
    const workflowsDir = path.join(tempDir, "workflows")
    mkdirSync(workflowsDir, { recursive: true })

    // Create sibling directory and file
    const siblingDir = path.join(tempDir, "lib")
    mkdirSync(siblingDir, { recursive: true })
    const siblingFile = path.join(siblingDir, "def.mjs")
    await writeFile(siblingFile, "export const value = 'lib-ok'", "utf8")

    // Create workflow file importing from sibling
    const workflowFile = path.join(workflowsDir, "index.mjs")
    await writeFile(workflowFile, `
      import { value } from "../lib/def.mjs"
      export const workflows = [
        {
          name: "dev-workflow",
          version: 1,
          startAt: "done",
          steps: {
            done: { kind: "end", label: value }
          }
        }
      ]
    `, "utf8")

    const moduleUrl = pathToFileURL(workflowFile)

    // Set env to dev
    const originalEnv = process.env.HIPPO_ENV
    process.env.HIPPO_ENV = "dev"

    try {
      const definitions = await loadWorkflowDefinitions(moduleUrl)
      expect(definitions).toHaveLength(1)
      expect(definitions[0]?.name).toBe("dev-workflow")
      expect(definitions[0]?.steps["done"]?.label).toBe("lib-ok")
    } finally {
      process.env.HIPPO_ENV = originalEnv
    }
  })
})
