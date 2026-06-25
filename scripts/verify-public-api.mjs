import assert from "node:assert/strict"

const sdk = await import("hippo/sdk")
const core = await import("hippo/core")
const server = await import("hippo/server")

assert.equal(typeof sdk.defineWorkflow, "function")
assert.equal(typeof sdk.taskStep, "function")
assert.equal(typeof sdk.renderWorkflowAsMermaid, "function")

assert.equal(typeof core.createWorkflowEngine, "function")
assert.equal(typeof core.createWorkflowStore, "function")
assert.equal(typeof core.createMetrics, "function")

assert.equal(typeof server.createApp, "function")
assert.equal(typeof server.startWorkerLoop, "function")
assert.equal(typeof server.getConfig, "function")

console.log("Verified hippo public API entrypoints")
