import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootPackageJson = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8")
)

const packages = [
  {
    directory: "core",
    exportsTarget: "./dist/src/core.js",
    description: "Hippo core engine, store, tracing, and shared runtime types",
    readmeHeading: "@hippo/core",
    dependencies: {
      "@opentelemetry/api": rootPackageJson.dependencies["@opentelemetry/api"],
      "@pgtyped/runtime": rootPackageJson.dependencies["@pgtyped/runtime"],
      pg: rootPackageJson.dependencies.pg,
      "prom-client": rootPackageJson.dependencies["prom-client"],
    },
    artifacts: [
      "src/core",
      "src/lib/db",
      "src/lib/metrics",
      "src/lib/notifier",
      "src/lib/tracing",
      "src/lib/workflow-engine",
      "src/lib/workflow-store",
      "src/queries/workflow-store.queries",
      "src/types/json",
      "src/types/workflow",
    ],
  },
  {
    directory: "sdk",
    exportsTarget: "./dist/src/sdk.js",
    description: "Hippo workflow definition helpers and TypeScript-first SDK surface",
    readmeHeading: "@hippo/sdk",
    dependencies: {},
    artifacts: [
      "src/sdk",
      "src/lib/workflow-definition",
      "src/types/json",
      "src/types/workflow",
    ],
  },
  {
    directory: "server",
    exportsTarget: "./dist/src/server.js",
    description: "Hippo Fastify app, worker loop, recovery loop, and server bootstrap helpers",
    readmeHeading: "@hippo/server",
    dependencies: {
      "@fastify/sensible": rootPackageJson.dependencies["@fastify/sensible"],
      fastify: rootPackageJson.dependencies.fastify,
      "cron-parser": rootPackageJson.dependencies["cron-parser"],
      zod: rootPackageJson.dependencies.zod,
    },
    artifacts: [
      "src/app",
      "src/server",
      "src/lib/auth",
      "src/lib/config",
      "src/lib/metrics",
      "src/lib/notifier",
      "src/lib/outbox",
      "src/lib/recovery",
      "src/lib/scheduler",
      "src/lib/tracing",
      "src/lib/worker",
      "src/lib/workflow-definition",
      "src/routes/dashboard",
      "src/routes/health",
      "src/routes/metrics",
      "src/routes/workflows",
      "src/types/json",
      "src/types/workflow",
    ],
  },
]

const createPackageReadme = (heading, description) => `# ${heading}

${description}.

## Local Preview

\`\`\`bash
npm install
npm run build
\`\`\`

The root build copies the compiled runtime into this workspace package so the
package manifest can be smoke-tested locally before any publish step is added.
`

const artifactSuffixes = [".js", ".d.ts", ".js.map", ".d.ts.map"]

const copyArtifact = async (relativeStem, destinationRoot) => {
  for (const suffix of artifactSuffixes) {
    const sourcePath = path.join(repoRoot, "dist", `${relativeStem}${suffix}`)

    try {
      const sourceStat = await stat(sourcePath)

      if (!sourceStat.isFile()) {
        continue
      }

      const destinationPath = path.join(
        destinationRoot,
        `${relativeStem}${suffix}`
      )
      await mkdir(path.dirname(destinationPath), { recursive: true })
      await cp(sourcePath, destinationPath)
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue
      }

      throw error
    }
  }
}

for (const pkg of packages) {
  const packageRoot = path.join(repoRoot, "packages", pkg.directory)
  const packageDist = path.join(packageRoot, "dist")

  await mkdir(packageRoot, { recursive: true })
  await rm(packageDist, { force: true, recursive: true })
  await mkdir(packageDist, { recursive: true })

  for (const artifact of pkg.artifacts) {
    await copyArtifact(artifact, packageDist)
  }

  const manifest = {
    name: `@hippo/${pkg.directory}`,
    version: rootPackageJson.version,
    private: true,
    type: "module",
    description: pkg.description,
    engines: rootPackageJson.engines,
    dependencies: pkg.dependencies,
    files: ["dist", "README.md"],
    exports: {
      ".": {
        types: pkg.exportsTarget.replace(".js", ".d.ts"),
        default: pkg.exportsTarget,
      },
    },
  }

  await writeFile(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  )
  await writeFile(
    path.join(packageRoot, "README.md"),
    createPackageReadme(pkg.readmeHeading, pkg.description),
    "utf8"
  )
}
