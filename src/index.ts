import { getConfig } from "./lib/config.js"
import { runHippoProcessRole } from "./lib/process-runtime.js"
import { workflowModulePath } from "./lib/workflow-loader.js"

const main = async () => {
  const config = getConfig()
  await runHippoProcessRole({
    config,
    role: config.HIPPO_ROLE,
    workflowsPath: workflowModulePath(),
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
