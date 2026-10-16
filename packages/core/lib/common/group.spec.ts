import { eventsToCsv, groupEvents } from "./group"
import { WorkEvent } from "../types"

const event = (over: Partial<WorkEvent>): WorkEvent => ({
  id: Math.random().toString(),
  timestamp: "2026-01-10T12:00:00.000Z",
  timeframe: "1h",
  minutes: 60,
  project: "a",
  description: "work",
  created: "",
  updated: "",
  ...over,
})

describe("groupEvents", () => {
  it("merges events with the same day, project and description", () => {
    const groups = groupEvents([event({}), event({ minutes: 30, timeframe: "30m" })])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      date: "2026-01-10",
      project: "a",
      description: "work",
      totalMinutes: 90,
      eventCount: 2,
    })
  })

  it("keeps different projects, descriptions and days apart, newest first", () => {
    const groups = groupEvents([
      event({}),
      event({ project: "b" }),
      event({ description: "other" }),
      event({ timestamp: "2026-01-12T12:00:00.000Z" }),
    ])
    expect(groups).toHaveLength(4)
    expect(groups[0].date).toBe("2026-01-12")
  })
})

describe("eventsToCsv", () => {
  it("writes a header and hours with two decimals, oldest first", () => {
    const csv = eventsToCsv([
      event({ timestamp: "2026-01-12T12:00:00.000Z", minutes: 90 }),
      event({}),
    ])
    expect(csv).toBe(
      "date,project,description,hours\n2026-01-10,a,work,1.00\n2026-01-12,a,work,1.50\n",
    )
  })

  it("escapes commas, quotes and newlines", () => {
    const csv = eventsToCsv([event({ description: 'say "hi", ok\nbye' })])
    expect(csv).toContain('"say ""hi"", ok\nbye"')
  })
})
