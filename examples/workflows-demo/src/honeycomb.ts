import { registerOtelFromEnv } from "../../../src/lib/tracing.js"

const stopTracing = registerOtelFromEnv({
  env: {
    ...process.env,
    OTEL_EXPORTER_OTLP_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      "https://api.honeycomb.io/v1/traces",
    OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? "hippo-demo",
  },
})

console.log("Honeycomb tracing bootstrap ready.")
console.log(`service.name=${process.env.OTEL_SERVICE_NAME ?? "hippo-demo"}`)
console.log(
  `endpoint=${
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    "https://api.honeycomb.io/v1/traces"
  }`
)

await stopTracing()
