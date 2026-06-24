import { Buffer } from "node:buffer"
import { createHmac, timingSafeEqual } from "node:crypto"

import type { FastifyRequest } from "fastify"

import type { JsonValue } from "../types/json.js"

const stableStringify = (value: JsonValue | undefined): string => {
  if (value === undefined) {
    return "null"
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`
}

const asBearerToken = (header: string | undefined) => {
  if (!header) {
    return null
  }

  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? null
}

const asSafeBuffer = (value: string) => Buffer.from(value, "utf8")

const isTimingSafeMatch = (left: string, right: string) => {
  const leftBuffer = asSafeBuffer(left)
  const rightBuffer = asSafeBuffer(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const createApiAuthenticator = (token?: string) => {
  if (!token) {
    return () => true
  }

  return (request: FastifyRequest) => {
    const actual = asBearerToken(request.headers.authorization)
    return actual ? isTimingSafeMatch(actual, token) : false
  }
}

const computeCallbackSignature = (args: {
  body: JsonValue
  secret: string
  timestamp: string
}) =>
  createHmac("sha256", args.secret)
    .update(`${args.timestamp}.${stableStringify(args.body)}`)
    .digest("hex")

export const createCallbackAuthenticator = (args: {
  secret: string | undefined
  toleranceSeconds: number
}) => {
  const secret = args.secret

  if (!secret) {
    return () => true
  }

  return (request: FastifyRequest, body: JsonValue) => {
    const timestamp = request.headers["x-hippo-timestamp"]
    const signature = request.headers["x-hippo-signature"]

    if (typeof timestamp !== "string" || typeof signature !== "string") {
      return false
    }

    const timestampMs = Number(timestamp) * 1_000

    if (!Number.isFinite(timestampMs)) {
      return false
    }

    const ageMs = Math.abs(Date.now() - timestampMs)

    if (ageMs > args.toleranceSeconds * 1_000) {
      return false
    }

    const expected = computeCallbackSignature({
      body,
      secret,
      timestamp,
    })

    return isTimingSafeMatch(signature, expected)
  }
}

export const signCallbackBody = (args: {
  body: JsonValue
  secret: string
  timestamp: string
}) => computeCallbackSignature(args)

export type HippoAuth = {
  verifyApiRequest: (request: FastifyRequest) => boolean
  verifyCallbackRequest: (request: FastifyRequest, body: JsonValue) => boolean
}
