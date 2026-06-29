import { watch, cpSync, symlinkSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import type { WorkflowDefinition } from "../types/workflow.js"
import type { WorkflowEngine } from "./workflow-engine.js"

type WorkflowWatcher = {
  close: () => void
}

type WorkflowModule = {
  workflows?: unknown
}

const asWorkflowDefinitions = (value: unknown, modulePath: URL) => {
  if (!Array.isArray(value)) {
    throw new Error(
      `Workflow module "${fileURLToPath(modulePath)}" must export a "workflows" array`
    )
  }

  return value as WorkflowDefinition[]
}

const tempDirsToCleanup = new Set<string>()

export const loadWorkflowDefinitions = async (modulePath: URL) => {
  const isDev = process.env.HIPPO_ENV === "dev"

  if (!isDev) {
    const nextUrl = new URL(modulePath)
    nextUrl.searchParams.set("t", String(Date.now()))
    const module = (await import(nextUrl.href)) as WorkflowModule
    return asWorkflowDefinitions(module.workflows, modulePath)
  }

  // Cleanup old reload directories
  for (const oldDir of tempDirsToCleanup) {
    try {
      rmSync(oldDir, { recursive: true, force: true })
      tempDirsToCleanup.delete(oldDir)
    } catch {
      // ignore
    }
  }

  const filePath = fileURLToPath(modulePath)
  const workflowsDir = path.dirname(filePath)
  const parentDir = path.dirname(workflowsDir)
  const workflowsDirName = path.basename(workflowsDir)
  const fileName = path.basename(filePath)

  const reloadDir = path.join(parentDir, `.reload-${randomUUID()}`)
  mkdirSync(reloadDir, { recursive: true })
  tempDirsToCleanup.add(reloadDir)

  const entries = readdirSync(parentDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith(".reload-")) {
      continue
    }

    const srcPath = path.join(parentDir, entry.name)
    const destPath = path.join(reloadDir, entry.name)

    if (entry.name === workflowsDirName) {
      cpSync(srcPath, destPath, { recursive: true })
    } else {
      const type = entry.isDirectory() ? "dir" : "file"
      const symlinkType = process.platform === "win32" && type === "dir" ? "junction" : type
      symlinkSync(srcPath, destPath, symlinkType)
    }
  }

  const tempModulePath = path.join(reloadDir, workflowsDirName, fileName)
  const tempModuleUrl = pathToFileURL(tempModulePath)
  tempModuleUrl.searchParams.set("t", String(Date.now()))

  const module = (await import(tempModuleUrl.href)) as WorkflowModule
  return asWorkflowDefinitions(module.workflows, modulePath)
}

export const startWorkflowDevReloader = async (args: {
  engine: WorkflowEngine
  debounceMs?: number
  loadDefinitions?: (modulePath: URL) => Promise<WorkflowDefinition[]>
  logger: {
    error: (payload: unknown, message?: string) => void
    info: (payload: unknown, message?: string) => void
  }
  modulePath: URL
  watchImpl?: (
    path: string,
    listener: () => void
  ) => WorkflowWatcher
}) => {
  const workflowDirectory = path.dirname(fileURLToPath(args.modulePath))
  let active = true
  let timer: ReturnType<typeof setTimeout> | null = null
  let reloading = false
  const debounceMs = args.debounceMs ?? 100
  const loadDefinitions = args.loadDefinitions ?? loadWorkflowDefinitions

  const reload = async () => {
    if (!active || reloading) {
      return
    }

    reloading = true

    try {
      const nextDefinitions = await loadDefinitions(args.modulePath)
      const latestDefinitions = args.engine.replaceDefinitions(nextDefinitions)

      args.logger.info(
        {
          workflowCount: latestDefinitions.length,
          workflowNames: latestDefinitions.map((definition) => definition.name),
        },
        "Reloaded workflow definitions"
      )
    } catch (error) {
      args.logger.error(
        {
          error,
          modulePath: fileURLToPath(args.modulePath),
        },
        "Failed to hot-reload workflow definitions"
      )
    } finally {
      reloading = false
    }
  }

  const scheduleReload = () => {
    if (!active) {
      return
    }

    if (timer) {
      clearTimeout(timer)
    }

    timer = setTimeout(() => {
      timer = null
      void reload()
    }, debounceMs)
  }

  const watcher = (args.watchImpl ?? ((watchPath, listener) => watch(watchPath, listener)))(
    workflowDirectory,
    () => {
    scheduleReload()
    }
  )

  return async () => {
    active = false

    if (timer) {
      clearTimeout(timer)
      timer = null
    }

    watcher.close()

    for (const oldDir of tempDirsToCleanup) {
      try {
        rmSync(oldDir, { recursive: true, force: true })
        tempDirsToCleanup.delete(oldDir)
      } catch {
        // ignore
      }
    }
  }
}

export const workflowModulePath = () =>
  pathToFileURL(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      `../workflows/index${path.extname(fileURLToPath(import.meta.url))}`
    )
  )
