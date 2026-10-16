import { getDb, setDb } from "../common/db"
import { getStats } from "./stats"
import { createEvent } from "./workEvent"
import { migratedMemoryDb } from "../testing/memoryDb"

beforeAll(async () => {
  setDb(await migratedMemoryDb())
})

afterAll(async () => {
  await getDb().destroy()
})

beforeEach(async () => {
  await getDb()("work_event").delete()
})

// Midday UTC keeps the local calendar date stable in any timezone within +/-11h
const at = (day: string) => `${day}T12:00:00.000Z`

describe("getStats", () => {
  it("returns zeros when there is no data", async () => {
    expect(await getStats()).toEqual({ totalMinutes: 0, eventCount: 0, byProject: [], byDay: [] })
  })

  it("totals minutes and groups by project, largest first", async () => {
    await createEvent({ project: "a", timeframe: "30m", timestamp: at("2026-01-10") })
    await createEvent({ project: "b", timeframe: "2h", timestamp: at("2026-01-10") })
    await createEvent({ project: "a", timeframe: "15m", timestamp: at("2026-01-11") })

    const stats = await getStats()
    expect(stats.totalMinutes).toBe(165)
    expect(stats.eventCount).toBe(3)
    expect(stats.byProject).toEqual([
      { project: "b", minutes: 120, eventCount: 1 },
      { project: "a", minutes: 45, eventCount: 2 },
    ])
  })

  it("groups by local day and project, oldest day first", async () => {
    await createEvent({ project: "a", timeframe: "1h", timestamp: at("2026-01-11") })
    await createEvent({ project: "a", timeframe: "30m", timestamp: at("2026-01-10") })
    await createEvent({ project: "b", timeframe: "30m", timestamp: at("2026-01-10") })

    expect((await getStats()).byDay).toEqual([
      { date: "2026-01-10", minutes: 60, byProject: { a: 30, b: 30 } },
      { date: "2026-01-11", minutes: 60, byProject: { a: 60 } },
    ])
  })

  it("respects filters and ignores deleted events", async () => {
    await createEvent({ project: "a", timeframe: "1h", timestamp: at("2026-01-10") })
    await createEvent({ project: "b", timeframe: "1h", timestamp: at("2026-01-20") })
    await getDb()("work_event").where({ project: "b" }).update({ deleted: true })
    await createEvent({ project: "b", timeframe: "1h", timestamp: at("2026-01-12") })

    expect((await getStats({ projects: ["a"] })).totalMinutes).toBe(60)
    expect(
      (await getStats({ minDate: new Date(at("2026-01-11")), maxDate: new Date(at("2026-01-31")) }))
        .byProject,
    ).toEqual([{ project: "b", minutes: 60, eventCount: 1 }])
  })
})
