import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const loadWorkspaceEntrypoint = async (directory) => {
  const packageRoot = path.join(repoRoot, "packages", directory)
  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, "package.json"), "utf8")
  )
  const exportTarget = manifest.exports?.["."]?.default

  assert.equal(typeof exportTarget, "string")
  assert.ok(manifest.dependencies)

  return import(pathToFileURL(path.join(packageRoot, exportTarget)).href)
}

const sdk = await import("hippo/sdk")
const core = await import("hippo/core")
const server = await import("hippo/server")
const workspaceSdk = await loadWorkspaceEntrypoint("sdk")
const workspaceCore = await loadWorkspaceEntrypoint("core")
const workspaceServer = await loadWorkspaceEntrypoint("server")

assert.equal(typeof sdk.defineWorkflow, "function")
assert.equal(typeof sdk.taskStep, "function")
assert.equal(typeof sdk.renderWorkflowAsMermaid, "function")

assert.equal(typeof core.createWorkflowEngine, "function")
assert.equal(typeof core.createWorkflowStore, "function")
assert.equal(typeof core.createMetrics, "function")

assert.equal(typeof server.createApp, "function")
assert.equal(typeof server.startWorkerLoop, "function")
assert.equal(typeof server.getConfig, "function")

assert.equal(typeof workspaceSdk.defineWorkflow, "function")
assert.equal(typeof workspaceCore.createWorkflowEngine, "function")
assert.equal(typeof workspaceServer.createApp, "function")

console.log("Verified hippo public API entrypoints")
