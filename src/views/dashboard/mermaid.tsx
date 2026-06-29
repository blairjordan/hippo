import { h } from "./jsx-runtime.js"
import { escapeHtml } from "./shell.js"

let mermaidMountCounter = 0
export const nextMermaidMountId = () =>
  `hm-${(++mermaidMountCounter).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const renderMermaidMount = (
  graph: string,
  nodeActions?: Record<
    string,
    { label: string; nodeText?: string; stepKey?: string; href?: string }
  >
) => {
  if (!nodeActions || Object.keys(nodeActions).length === 0) {
    return `<div class="mermaid" data-graph="${escapeHtml(graph)}"></div>`
  }

  const mountId = nextMermaidMountId()
  const clickLines = Object.entries(nodeActions).map(([nodeId, action]) => {
    const tooltip = (action.label ?? "").replaceAll('"', "'")
    return `  click ${nodeId} call hippoMermaidActivate("${mountId}", "${nodeId}")${
      tooltip ? ` "${tooltip}"` : ""
    }`
  })
  const enriched = `${graph}\n${clickLines.join("\n")}`

  return (
    <div class="mermaid" data-mount-id={mountId} data-graph={enriched}></div>
  )
}

export const renderMermaidBootstrap = () => `<script type="module">
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"

  const storageKey = "hippo-dashboard-theme"
  const root = document.documentElement
  const getPreferredTheme = () => {
    const storedTheme = window.localStorage.getItem(storageKey)

    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }

  const applyTheme = (theme) => {
    root.classList.toggle("dark", theme === "dark")
    root.style.colorScheme = theme
    window.localStorage.setItem(storageKey, theme)
    const toggle = document.querySelector("[data-theme-toggle]")

    if (toggle instanceof HTMLButtonElement) {
      toggle.dataset.theme = theme
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      )
      toggle.textContent = theme === "dark" ? "Light" : "Dark"
    }
  }

  const renderFallback = () => {
    for (const node of document.querySelectorAll(".mermaid")) {
      const graph = node.getAttribute("data-graph")

      if (!graph) {
        continue
      }

      node.innerHTML = '<pre class="mermaid-fallback"></pre>'
      const pre = node.querySelector("pre")

      if (pre) {
        pre.textContent = graph
      }
    }
  }

  const applyStepSelection = (stepKey) => {
    const cards = [...document.querySelectorAll("[data-step-key]")]
    let firstMatch = null

    for (const card of cards) {
      const matches = card instanceof HTMLElement && card.dataset.stepKey === stepKey
      card.classList.toggle("entry-selected", matches)

      if (matches && firstMatch === null && card instanceof HTMLElement) {
        firstMatch = card
      }
    }

    firstMatch?.scrollIntoView({ behavior: "smooth", block: "center" })
    return firstMatch !== null
  }

  window.hippoMermaidActivate = (mountId, nodeId) => {
    const registry = window.__hippoMermaidActions || {}
    const action = registry[mountId] && registry[mountId][nodeId]

    if (!action || typeof action !== "object") {
      return
    }

    if (typeof action.stepKey === "string") {
      const selected = applyStepSelection(action.stepKey)

      if (selected) {
        return
      }
    }

    if (typeof action.href === "string") {
      window.location.assign(action.href)
    }
  }

  const renderMermaids = async () => {
    const isDark = root.classList.contains("dark")

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: "base",
      themeVariables: {
        primaryColor: isDark ? "#0f172a" : "#ffffff",
        primaryTextColor: isDark ? "#e2e8f0" : "#0f172a",
        primaryBorderColor: isDark ? "#475569" : "#cbd5e1",
        lineColor: isDark ? "#64748b" : "#94a3b8",
        secondaryColor: isDark ? "#111827" : "#f8fafc",
        tertiaryColor: isDark ? "#020617" : "#f8fafc",
        background: "transparent",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      flowchart: {
        curve: "linear",
        useMaxWidth: true,
        htmlLabels: false,
      },
    })

    for (const node of document.querySelectorAll(".mermaid")) {
      const graph = node.getAttribute("data-graph")

      if (!graph) {
        continue
      }

      node.removeAttribute("data-processed")
      node.textContent = graph
    }

    try {
      await mermaid.run({
        querySelector: ".mermaid",
      })
    } catch (error) {
      renderFallback()
      console.error(error)
    }
  }

  applyTheme(getPreferredTheme())
  await renderMermaids()

  document.querySelector("[data-theme-toggle]")?.addEventListener("click", async () => {
    const nextTheme = root.classList.contains("dark") ? "light" : "dark"
    applyTheme(nextTheme)
    await renderMermaids()
  })
</script>
<script>
  // Add a click registry object for the actions used in window.hippoMermaidActivate
  window.__hippoMermaidActions = window.__hippoMermaidActions || {};
</script>`
