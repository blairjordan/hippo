import { createHmac, timingSafeEqual } from "node:crypto"

import type { JsonObject, JsonValue } from "../../types/json.js"
import type { HumanTaskDecision } from "../../types/workflow.js"

export type HumanTaskTimeoutOutcome = {
  nextStepKey: string
  context: JsonObject
  output: JsonValue | null
}

export type HumanTaskWaitPayload = {
  kind: "humanTask"
  approvalUrl: string
  formUrl: string
  prompt: JsonValue | null
  timeout: HumanTaskTimeoutOutcome
}

export type HumanTaskTokenClaims = {
  correlationKey: string
  exp: number
}

const asBuffer = (value: string) => Buffer.from(value, "utf8")

const stableStringify = (value: JsonValue): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] ?? null)}`)
    .join(",")}}`
}

const createSignature = (args: {
  claims: HumanTaskTokenClaims
  secret: string
}) =>
  createHmac("sha256", args.secret)
    .update(stableStringify(args.claims))
    .digest("base64url")

const isTimingSafeMatch = (left: string, right: string) => {
  const leftBuffer = asBuffer(left)
  const rightBuffer = asBuffer(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const buildHumanTaskCorrelationKey = (args: {
  runId: string
  stepKey: string
}) => `human:${args.runId}:${args.stepKey}`

export const signHumanTaskToken = (args: {
  correlationKey: string
  expiresAt: Date
  secret: string
}) => {
  const claims: HumanTaskTokenClaims = {
    correlationKey: args.correlationKey,
    exp: args.expiresAt.getTime(),
  }
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url")
  const signature = createSignature({
    claims,
    secret: args.secret,
  })

  return `${payload}.${signature}`
}

export const verifyHumanTaskToken = (args: {
  token: string
  secret: string | undefined
  toleranceSeconds: number
  now?: Date
}) => {
  if (!args.secret) {
    return null
  }

  const [encodedClaims, signature] = args.token.split(".")

  if (!encodedClaims || !signature) {
    return null
  }

  let claims: HumanTaskTokenClaims

  try {
    claims = JSON.parse(Buffer.from(encodedClaims, "base64url").toString("utf8")) as HumanTaskTokenClaims
  } catch {
    return null
  }

  if (
    typeof claims.correlationKey !== "string" ||
    claims.correlationKey.length === 0 ||
    typeof claims.exp !== "number" ||
    !Number.isFinite(claims.exp)
  ) {
    return null
  }

  const expectedSignature = createSignature({
    claims,
    secret: args.secret,
  })

  if (!isTimingSafeMatch(signature, expectedSignature)) {
    return null
  }

  const now = args.now ?? new Date()

  if (claims.exp + args.toleranceSeconds * 1_000 < now.getTime()) {
    return null
  }

  return claims
}

export const createHumanTaskDecision = (args: {
  decision: HumanTaskDecision["decision"]
  data: JsonValue | undefined
}): HumanTaskDecision => ({
  decision: args.decision,
  ...(args.data === undefined ? {} : { data: args.data }),
})

export const isHumanTaskWaitPayload = (
  value: JsonValue | null | undefined
): value is HumanTaskWaitPayload => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  const timeout = record["timeout"]

  return (
    record["kind"] === "humanTask" &&
    typeof record["approvalUrl"] === "string" &&
    typeof record["formUrl"] === "string" &&
    timeout !== null &&
    typeof timeout === "object" &&
    !Array.isArray(timeout) &&
    typeof (timeout as Record<string, unknown>)["nextStepKey"] === "string" &&
    typeof (timeout as Record<string, unknown>)["context"] === "object" &&
    (timeout as Record<string, unknown>)["context"] !== null &&
    !Array.isArray((timeout as Record<string, unknown>)["context"])
  )
}
