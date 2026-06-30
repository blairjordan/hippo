import { describe, expect, it } from "vitest"
import { setupTestDatabase, testDatabaseUrl } from "./workflow-store.pg.test-helpers.js"

describe.skipIf(!testDatabaseUrl)("workflow store postgres integration - schedules", () => {
  const { getStore } = setupTestDatabase()

  it("creates and lists schedules in postgres", async () => {
    const store = getStore()
    const nextFireAt = new Date(Date.now() + 60_000)
    const schedule = await store.createSchedule({
      workflowName: "scheduled-workflow",
      cronExpression: "*/5 * * * *",
      payload: { test: true },
      taskQueue: "default",
      priority: 10,
      nextFireAt,
    })

    expect(schedule.workflowName).toBe("scheduled-workflow")
    expect(schedule.cronExpression).toBe("*/5 * * * *")
    expect(schedule.payload).toEqual({ test: true })
    expect(schedule.taskQueue).toBe("default")
    expect(schedule.priority).toBe(10)

    const list = await store.listSchedules()
    expect(list.some((s) => s.id === schedule.id)).toBe(true)
  })
})
