import { execFile } from "node:child_process"
import { mkdtemp, readFile, symlink } from "node:fs/promises"
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

    const envFile = await readFile(path.join(projectDir, ".env"), "utf8")
    const envExampleFile = await readFile(path.join(projectDir, ".env.example"), "utf8")

    expect(packageJson.name).toBe("demo-app")
    expect(packageJson.scripts["hippo:dev"]).toBe("tsx scripts/hippo-dev.ts")
    expect(packageJson.scripts["render:example"]).toBe(
      "tsx scripts/render-example.ts"
    )
    expect(packageJson.scripts["start"]).toBeDefined()
    expect(packageJson.scripts["dev"]).toBeDefined()
    expect(packageJson.scripts["build"]).toBeDefined()

    expect(workflowIndex).toContain("exampleWorkflow")
    expect(workflowFile).toContain('name: "example-delivery"')
    expect(workflowFile).toContain('import {')
    expect(workflowFile).toContain('"../lib/workflow-definition.js"')

    expect(readme).toContain("hippo init")
    expect(readme).toContain("npm install")
    expect(readme).toContain("npm run hippo:dev")
    expect(readme).toContain("curl -X POST")

    expect(envFile).toContain("DATABASE_URL=")
    expect(envExampleFile).toContain("DATABASE_URL=")

    // Link node_modules from repo root to the scaffolded project to resolve dependencies locally
    await symlink(
      path.join(repoRoot, "node_modules"),
      path.join(projectDir, "node_modules"),
      "dir"
    )

    // Verify typecheck compiles successfully
    await execFileAsync("npm", ["run", "typecheck"], { cwd: projectDir })

    // Verify render script executes successfully and outputs the Mermaid graph
    const { stdout: renderOutput } = await execFileAsync(
      "npm",
      ["run", "render:example"],
      { cwd: projectDir }
    )
    expect(renderOutput).toContain("flowchart TD")
    expect(renderOutput).toContain("classify_recipient")
  })
})
