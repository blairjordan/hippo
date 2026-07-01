import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
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
    readmeHeading: "pygmyhippo-core",
    dependencies: {
      "@opentelemetry/api": rootPackageJson.dependencies["@opentelemetry/api"],
      "@pgtyped/runtime": rootPackageJson.dependencies["@pgtyped/runtime"],
      pg: rootPackageJson.dependencies.pg,
      "prom-client": rootPackageJson.dependencies["prom-client"],
    },
    artifacts: [
      "src/core",
      "src/lib",
      "src/queries",
      "src/types",
    ],
  },
  {
    directory: "sdk",
    exportsTarget: "./dist/src/sdk.js",
    description: "Hippo workflow definition helpers and TypeScript-first SDK surface",
    readmeHeading: "pygmyhippo-sdk",
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
    readmeHeading: "pygmyhippo-server",
    dependencies: {
      "@fastify/sensible": rootPackageJson.dependencies["@fastify/sensible"],
      fastify: rootPackageJson.dependencies.fastify,
      "cron-parser": rootPackageJson.dependencies["cron-parser"],
      zod: rootPackageJson.dependencies.zod,
    },
    artifacts: [
      "src/app",
      "src/server",
      "src/lib",
      "src/routes/dashboard",
      "src/routes/health",
      "src/routes/human-tasks",
      "src/routes/metrics",
      "src/routes/workflows",
      "src/queries",
      "src/types",
      "src/views/dashboard",
    ],
  },
  {
    directory: "cli",
    exportsTarget: "./dist/src/cli.js",
    description: "Hippo operator command-line interface",
    readmeHeading: "pygmyhippo-cli",
    dependencies: {
      "commander": rootPackageJson.dependencies["commander"] || "^12.1.0",
      "pg": rootPackageJson.dependencies["pg"],
      "@fastify/sensible": rootPackageJson.dependencies["@fastify/sensible"],
      "fastify": rootPackageJson.dependencies["fastify"],
      "cron-parser": rootPackageJson.dependencies["cron-parser"],
      "zod": rootPackageJson.dependencies["zod"],
      "@opentelemetry/api": rootPackageJson.dependencies["@opentelemetry/api"],
      "@pgtyped/runtime": rootPackageJson.dependencies["@pgtyped/runtime"],
      "prom-client": rootPackageJson.dependencies["prom-client"],
    },
    artifacts: [
      "src/cli",
      "src/app",
      "src/server",
      "src/lib",
      "src/routes/dashboard",
      "src/routes/health",
      "src/routes/human-tasks",
      "src/routes/metrics",
      "src/routes/workflows",
      "src/queries",
      "src/types",
      "src/views/dashboard",
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
  const dirPath = path.join(repoRoot, "dist", relativeStem)
  try {
    const dirStat = await stat(dirPath)
    if (dirStat.isDirectory()) {
      const copyDir = async (srcDir, destDir) => {
        await mkdir(destDir, { recursive: true })
        const entries = await readdir(srcDir, { withFileTypes: true })
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry.name)
          const destPath = path.join(destDir, entry.name)
          if (entry.isDirectory()) {
            await copyDir(srcPath, destPath)
          } else {
            await cp(srcPath, destPath)
          }
        }
      }
      await copyDir(dirPath, path.join(destinationRoot, relativeStem))
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error
    }
  }

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
    name: `pygmyhippo-${pkg.directory}`,
    version: rootPackageJson.version,
    private: false,
    type: "module",
    description: pkg.description,
    engines: rootPackageJson.engines,
    dependencies: pkg.dependencies,
    files: ["dist", "README.md", ...(pkg.directory === "cli" ? ["bin"] : [])],
    exports: {
      ".": {
        types: pkg.exportsTarget.replace(".js", ".d.ts"),
        default: pkg.exportsTarget,
      },
    },
    ...(pkg.directory === "cli"
      ? {
          bin: {
            hippo: "./bin/hippo.js",
          },
        }
      : {}),
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

  if (pkg.directory === "cli") {
    const binDir = path.join(packageRoot, "bin")
    await mkdir(binDir, { recursive: true })
    const binContent = `#!/usr/bin/env node\nimport "../dist/src/cli.js"\n`
    await writeFile(path.join(binDir, "hippo.js"), binContent, {
      encoding: "utf8",
      mode: 0o755,
    })
  }
}
