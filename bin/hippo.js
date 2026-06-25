#!/usr/bin/env node

import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const command = process.argv[2]
const targetArg = process.argv[3]
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const parsePackageJson = async () =>
  JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"))

const createExampleWorkflowSource = () => `import { createHash } from "node:crypto"

import {
  defineWorkflow,
  endStep,
  sleepStep,
  taskStep,
  waitStep,
} from "../lib/workflow-definition.js"

const createCorrelationKey = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24)

export const exampleWorkflow = defineWorkflow({
  name: "example-delivery",
  version: 1,
  title: "Example delivery workflow",
  startAt: "classify-recipient",
  steps: {
    "classify-recipient": taskStep({
      kind: "task",
      label: "Classify recipient",
      transitions: {
        email: "send-email",
        sms: "send-sms",
        webhook: "send-webhook",
      },
      run: ({ input }) => {
        const recipientType =
          typeof input.email === "string"
            ? "email"
            : typeof input.phoneNumber === "string"
              ? "sms"
              : "webhook"

        return {
          patch: { recipientType },
          transition:
            recipientType === "email"
              ? "send-email"
              : recipientType === "sms"
                ? "send-sms"
                : "send-webhook",
        }
      },
    }),
    "send-email": taskStep({
      kind: "task",
      label: "Send email",
      next: "delivery-confirmation",
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 1_000,
      },
      run: ({ idempotencyKey, input }) => ({
        patch: {
          provider: "email",
          outboundRequestId: createCorrelationKey(
            \`\${idempotencyKey}:email:\${String(input.email)}\`
          ),
        },
        output: {
          accepted: true,
        },
      }),
    }),
    "send-sms": taskStep({
      kind: "task",
      label: "Send SMS",
      next: "delivery-confirmation",
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 1_000,
      },
      run: ({ idempotencyKey, input }) => ({
        patch: {
          provider: "sms",
          outboundRequestId: createCorrelationKey(
            \`\${idempotencyKey}:sms:\${String(input.phoneNumber)}\`
          ),
        },
        output: {
          accepted: true,
        },
      }),
    }),
    "send-webhook": taskStep({
      kind: "task",
      label: "Send webhook",
      next: "cooldown",
      retry: {
        maxAttempts: 3,
        initialBackoffMs: 1_000,
      },
      run: ({ idempotencyKey, input }) => ({
        patch: {
          provider: "webhook",
          outboundRequestId: createCorrelationKey(
            \`\${idempotencyKey}:webhook:\${String(input.url)}\`
          ),
        },
        output: {
          accepted: true,
        },
      }),
    }),
    cooldown: sleepStep({
      kind: "sleep",
      label: "Cooldown",
      next: "delivery-confirmation",
      until: 5_000,
    }),
    "delivery-confirmation": waitStep({
      kind: "wait",
      label: "Wait for provider callback",
      next: "done",
      timeoutMs: 86_400_000,
      open: ({ run, context }) => ({
        correlationKey: createCorrelationKey(
          \`\${run.id}:\${String(context.outboundRequestId ?? "missing")}\`
        ),
        payload: {
          outboundRequestId: context.outboundRequestId ?? null,
        },
      }),
      resume: (_context, payload) => ({
        patch: {
          providerResponse: payload ?? { status: "delivered" },
        },
      }),
    }),
    done: endStep({
      label: "Completed",
    }),
  },
})
`

const createWorkflowIndexSource = () => `import { exampleWorkflow } from "./example.js"

export const workflows = [exampleWorkflow]
`

const createRenderExampleSource = () => `import { renderWorkflowAsMermaid } from "../src/lib/workflow-definition.js"
import { exampleWorkflow } from "../src/workflows/example.js"

console.log(renderWorkflowAsMermaid(exampleWorkflow))
`

const createScaffoldReadme = (projectName) => `# ${projectName}

Bootstrapped by \`hippo init\`.

## Quickstart

\`\`\`bash
npm install
npm run hippo:dev
\`\`\`

Open \`http://127.0.0.1:3000/dashboard\` and start a run:

\`\`\`bash
curl -X POST \\
  -H "Authorization: Bearer demo-token" \\
  -H "Content-Type: application/json" \\
  http://127.0.0.1:3000/v1/workflows/example-delivery/runs \\
  -d '{"email":"hello@example.com"}'
\`\`\`
`

const sanitizePackageName = (value) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-_]+/g, "-")
    .replaceAll(/^-+|-+$/g, "") || "hippo-app"

const ensureTargetIsEmpty = async (targetDir) => {
  try {
    const entries = await readdir(targetDir)

    if (entries.length > 0) {
      throw new Error(`Target directory "${targetDir}" is not empty`)
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      await mkdir(targetDir, { recursive: true })
      return
    }

    throw error
  }
}

const writeJson = async (targetPath, value) => {
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

const copyRelativePath = async (relativePath, targetDir) => {
  await cp(
    path.join(repoRoot, relativePath),
    path.join(targetDir, relativePath),
    { recursive: true }
  )
}

const createInitPackageJson = async (projectName) => {
  const sourcePackage = await parsePackageJson()

  return {
    name: sanitizePackageName(projectName),
    version: "0.1.0",
    private: true,
    type: "module",
    description: "Hippo workflow app scaffold",
    engines: sourcePackage.engines,
    scripts: {
      dev: sourcePackage.scripts.dev,
      "hippo:dev": sourcePackage.scripts["hippo:dev"],
      start: sourcePackage.scripts.start,
      build: sourcePackage.scripts.build,
      typecheck: sourcePackage.scripts.typecheck,
      lint: sourcePackage.scripts.lint,
      test: sourcePackage.scripts.test,
      "test:watch": sourcePackage.scripts["test:watch"],
      "db:migrate": sourcePackage.scripts["db:migrate"],
      "render:example": "tsx scripts/render-example.ts",
    },
    dependencies: sourcePackage.dependencies,
    devDependencies: sourcePackage.devDependencies,
  }
}

const scaffoldProject = async (projectName, targetDir) => {
  await ensureTargetIsEmpty(targetDir)

  for (const relativePath of [
    ".gitignore",
    ".env.example",
    "docker-compose.yml",
    "eslint.config.js",
    "pgtyped-config.json",
    "tsconfig.json",
    "db/migrations",
    "src/lib",
    "src/routes",
    "src/types",
    "src/sql",
    "src/queries",
    "src/app.ts",
    "src/index.ts",
    "scripts/hippo-dev.ts",
  ]) {
    await copyRelativePath(relativePath, targetDir)
  }

  await mkdir(path.join(targetDir, "src", "workflows"), { recursive: true })
  await mkdir(path.join(targetDir, "scripts"), { recursive: true })

  await writeJson(
    path.join(targetDir, "package.json"),
    await createInitPackageJson(projectName)
  )
  await writeFile(
    path.join(targetDir, ".env"),
    await readFile(path.join(repoRoot, ".env.example"), "utf8"),
    "utf8"
  )
  await writeFile(
    path.join(targetDir, "README.md"),
    createScaffoldReadme(projectName),
    "utf8"
  )
  await writeFile(
    path.join(targetDir, "src", "workflows", "example.ts"),
    createExampleWorkflowSource(),
    "utf8"
  )
  await writeFile(
    path.join(targetDir, "src", "workflows", "index.ts"),
    createWorkflowIndexSource(),
    "utf8"
  )
  await writeFile(
    path.join(targetDir, "scripts", "render-example.ts"),
    createRenderExampleSource(),
    "utf8"
  )
}

const printHelp = () => {
  console.log("Usage: hippo init <project-directory>")
}

const main = async () => {
  if (command !== "init") {
    printHelp()
    process.exitCode = 1
    return
  }

  if (!targetArg) {
    printHelp()
    process.exitCode = 1
    return
  }

  const targetDir = path.resolve(process.cwd(), targetArg)
  const projectName = path.basename(targetDir)
  const targetStats = await stat(repoRoot)

  if (!targetStats.isDirectory()) {
    throw new Error(`Repository root "${repoRoot}" is not readable`)
  }

  await scaffoldProject(projectName, targetDir)
  console.log(`Scaffolded Hippo app in ${targetDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
