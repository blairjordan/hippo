import { h } from "./jsx-runtime.js"
import type { JsonValue } from "../../types/json.js"

export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

export const formatDateTime = (value: Date | null) =>
  value ? value.toISOString().replace("T", " ").replace("Z", " UTC") : "—"

export const formatJsonRaw = (value: JsonValue) =>
  JSON.stringify(value, null, 2) ?? "null"

export const formatJson = (value: JsonValue) => escapeHtml(formatJsonRaw(value))

export const statusToneByRun = {
  queued: "tone-queued",
  running: "tone-running",
  waiting: "tone-waiting",
  completed: "tone-completed",
  failed: "tone-failed",
  compensation_failed: "tone-failed",
  exhausted_budget: "tone-failed",
  canceled: "tone-canceled",
} as const

export type SidebarNavId = "runs" | "definitions" | "schedules"

export const renderSidebar = (activeNav: SidebarNavId | null) => {
  const item = (id: SidebarNavId, href: string, label: string) => (
    <a
      class={`sidebar-link${activeNav === id ? " sidebar-link-active" : ""}`}
      href={href}
    >
      {label}
    </a>
  )

  return (
    <aside class="sidebar">
      <a class="sidebar-brand" href="/dashboard/runs">
        <span class="brand-mark">H</span>
        <span>Hippo</span>
      </a>
      <div class="sidebar-section">
        <div class="sidebar-heading">Activity</div>
        {item("runs", "/dashboard/runs", "Runs")}
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">Catalog</div>
        {item("definitions", "/dashboard/definitions", "Definitions")}
      </div>
      <div class="sidebar-section">
        <div class="sidebar-heading">Orchestration</div>
        {item("schedules", "/dashboard/schedules", "Schedules")}
      </div>
      <div class="sidebar-foot">
        <button
          class="btn btn-outline btn-icon-only"
          type="button"
          data-theme-toggle
          aria-label="Switch theme"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon theme-toggle-sun">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="M4.93 4.93l1.41 1.41"></path>
            <path d="M17.66 17.66l1.41 1.41"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="M6.34 17.66l-1.41 1.41"></path>
            <path d="M19.07 4.93l-1.41 1.41"></path>
          </svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon theme-toggle-moon">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
          </svg>
        </button>
      </div>
    </aside>
  )
}

export const renderShellDocument = (args: {
  activeNav: SidebarNavId | null
  content: string
  includeMermaidBootstrap?: string
  title: string
  pageStyles?: string
}) => {
  const shellHtml = (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{args.title}</title>
        <link rel="stylesheet" href="/dashboard.css" />
        {args.pageStyles ? <style>{args.pageStyles}</style> : null}
      </head>
      <body>
        <div class="shell">
          {renderSidebar(args.activeNav)}
          <main class="content" unsafe-html-content-placeholder-do-not-remove-or-change="true">
            {/* The content itself is an HTML string passed in args.content */}
          </main>
        </div>
        {/* We can insert the raw scripts at the end */}
      </body>
    </html>
  )

  // Since we are compiling JSX to raw HTML string, the 'shellHtml' is actually a string.
  // We need to inject the unsafe HTML content ('args.content') and the scripts properly because
  // JSX escapes raw HTML strings by default.
  let doc = String(shellHtml)
  
  // Inject content inside the placeholder in the main tag
  const placeholder = 'unsafe-html-content-placeholder-do-not-remove-or-change="true">'
  doc = doc.replace(placeholder, ">" + args.content)

  // Append raw scripts before the closing body tag
  const scripts = `
    ${args.includeMermaidBootstrap ?? ""}
    <script>
      (() => {
        const root = document.documentElement
        const storageKey = "hippo-dashboard-theme"
        const getStored = () => {
          const v = window.localStorage.getItem(storageKey)
          return v === "light" || v === "dark" ? v : null
        }
        const apply = (theme) => {
          root.classList.toggle("dark", theme === "dark")
          root.style.colorScheme = theme
          window.localStorage.setItem(storageKey, theme)
          const btn = document.querySelector("[data-theme-toggle]")
          if (btn) {
            btn.dataset.theme = theme
            btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode")
          }
        }
        const initial = getStored() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        apply(initial)
        document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
          apply(root.classList.contains("dark") ? "light" : "dark")
          if (window.__hippoOnThemeChange) window.__hippoOnThemeChange()
        })

        const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        const jsonTokenRe = /("(?:\\\\u[a-fA-F0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(?:true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g
        window.hippoHighlightJson = (raw) => {
          const escaped = escapeHtml(raw)
          return escaped.replace(new RegExp(jsonTokenRe.source, "g"), (match) => {
            let cls = "j-num"
            if (match.startsWith("&quot;") || match.startsWith('"')) {
              cls = match.endsWith(":") || /:\\s*$/.test(match) ? "j-key" : "j-str"
            } else if (match === "true" || match === "false") {
              cls = "j-bool"
            } else if (match === "null") {
              cls = "j-null"
            }
            return '<span class="' + cls + '">' + match + "</span>"
          })
        }
        const highlightAll = (scope) => {
          ;(scope || document).querySelectorAll(".pre-json:not([data-highlighted])").forEach((el) => {
            el.innerHTML = window.hippoHighlightJson(el.textContent || "")
            el.setAttribute("data-highlighted", "1")
          })
        }
        window.hippoHighlightAllJson = highlightAll
        highlightAll(document)

        document.addEventListener("click", (event) => {
          const target = event.target
          if (!(target instanceof Element)) return
          if (target.closest("a, button, input, select, textarea, label, .chip")) return
          const row = target.closest("tr[data-href]")
          if (!row) return
          const href = row.getAttribute("data-href")
          if (!href) return
          if (event.metaKey || event.ctrlKey || event.button === 1) {
            window.open(href, "_blank")
          } else {
            window.location.assign(href)
          }
        })

        document.addEventListener("click", (event) => {
          const btn = event.target.closest("[data-tab-trigger]")
          if (!btn) return
          const tabId = btn.dataset.tabTrigger
          const card = btn.closest(".card")
          if (!card) return
          
          card.querySelectorAll("[data-tab-trigger]").forEach(el => el.classList.toggle("active", el === btn))
          card.querySelectorAll(".tab-pane").forEach(pane => {
            const isTarget = pane.id === "pane-" + tabId
            pane.classList.toggle("hidden", !isTarget)
          })
          document.querySelectorAll(".mermaidTooltip").forEach(el => el.remove())
        })

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return
          const target = event.target
          if (!(target instanceof Element)) return
          const row = target.closest("tr[data-href]")
          if (!row) return
          const href = row.getAttribute("data-href")
          if (href) window.location.assign(href)
        })
      })()
    </script>
  `
  
  return "<!doctype html>" + doc.replace("</body>", scripts + "</body>")
}
