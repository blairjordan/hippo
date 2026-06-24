import { createHash } from "node:crypto"

import {
  defineWorkflow,
  endStep,
  sleepStep,
  taskStep,
  waitStep,
} from "../lib/workflow-definition.js"

const createCorrelationKey = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24)

export const demoWorkflow = defineWorkflow({
  name: "demo-delivery",
  version: 1,
  title: "Demo delivery workflow",
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
            `${idempotencyKey}:email:${String(input.email)}`
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
            `${idempotencyKey}:sms:${String(input.phoneNumber)}`
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
            `${idempotencyKey}:webhook:${String(input.url)}`
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
          `${run.id}:${String(context.outboundRequestId ?? "missing")}`
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
