/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-namespace */
// Simple JSX-to-HTML-string runtime library

export function h(
  tag: string | ((props: any) => any),
  props: any,
  ...children: any[]
): string {
  // If it's a component function, call it
  if (typeof tag === "function") {
    return tag({ ...props, children: children.flat() })
  }

  // Build the opening tag and attributes
  const parts: string[] = []
  parts.push(`<${tag}`)

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children") continue
      if (key === "class") {
        parts.push(` class="${escapeHtml(String(value))}"`)
      } else if (value === true) {
        parts.push(` ${key}`)
      } else if (value !== false && value !== null && value !== undefined) {
        parts.push(` ${key}="${escapeHtml(String(value))}"`)
      }
    }
  }

  parts.push(">")

  // Render children
  const renderedChildren = children
    .flat()
    .map((child) => {
      if (child === null || child === undefined || child === false) return ""
      return String(child)
    })
    .join("")

  parts.push(renderedChildren)

  // Closing tag (unless it's a self-closing tag)
  const selfClosing = [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]
  if (!selfClosing.includes(tag.toLowerCase())) {
    parts.push(`</${tag}>`)
  }

  return parts.join("")
}

export const Fragment = (props: { children?: any[] }) => {
  return (props.children ?? []).flat().join("")
}

// Simple HTML escaping helper for attribute rendering
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

declare global {
  namespace JSX {
    type Element = string
    interface IntrinsicElements {
      [elem: string]: any
    }
  }
}
