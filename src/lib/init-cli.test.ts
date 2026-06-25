import { execFile } from "node:child_process"
import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)

describe("hippo init cli", () => {
  it("scaffolds a runnable project skeleton", async () => {
    const sandboxDir = await mkdtemp(path.join(os.tmpdir(), "hippo-init-"))
    const projectDir = path.join(sandboxDir, "demo-app")
    const repoRoot = path.resolve(import.meta.dirname, "..", "..")

    await execFileAsync("node", ["bin/hippo.js", "init", projectDir], {
      cwd: repoRoot,
    })

    const packageJson = JSON.parse(
      await readFile(path.join(projectDir, "package.json"), "utf8")
    ) as {
      name: string
      scripts: Record<string, string>
    }
    const workflowIndex = await readFile(
      path.join(projectDir, "src/workflows/index.ts"),
      "utf8"
    )
    const workflowFile = await readFile(
      path.join(projectDir, "src/workflows/example.ts"),
      "utf8"
    )
    const readme = await readFile(path.join(projectDir, "README.md"), "utf8")

    expect(packageJson.name).toBe("demo-app")
    expect(packageJson.scripts["hippo:dev"]).toBe("tsx scripts/hippo-dev.ts")
    expect(packageJson.scripts["render:example"]).toBe(
      "tsx scripts/render-example.ts"
    )
    expect(workflowIndex).toContain("exampleWorkflow")
    expect(workflowFile).toContain('name: "example-delivery"')
    expect(readme).toContain("hippo init")
  })
})
