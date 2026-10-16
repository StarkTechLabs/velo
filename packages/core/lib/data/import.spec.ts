import { getDb, setDb } from "../common/db"
import { migratedMemoryDb } from "../testing/memoryDb"
import { importEvents } from "./import"
import { deleteEvent, listEvents } from "./workEvent"

beforeAll(async () => {
  setDb(await migratedMemoryDb())
})

afterAll(async () => {
  await getDb().destroy()
})

beforeEach(async () => {
  await getDb()("work_event").delete()
})

const event = (id: string, over = {}) => ({
  id,
  project: "p",
  timeframe: "1h",
  description: "d",
  timestamp: "2026-01-10T10:00:00.000Z",
  ...over,
})

describe("importEvents", () => {
  it("inserts events with computed minutes and preserved ids", async () => {
    const result = await importEvents([event("a"), event("b", { timeframe: "30m" })])
    expect(result).toEqual({ imported: 2, skipped: 0, invalid: [] })
    const { data } = await listEvents()
    expect(data.map((e) => [e.id, e.minutes]).sort()).toEqual([
      ["a", 60],
      ["b", 30],
    ])
  })

  it("is idempotent: existing (even deleted) ids and in-input duplicates are skipped", async () => {
    await importEvents([event("a"), event("b")])
    await deleteEvent("b")
    const result = await importEvents([event("a"), event("b"), event("c"), event("c")])
    expect(result).toEqual({ imported: 1, skipped: 3, invalid: [] })
    expect((await listEvents()).total).toBe(2)
  })

  it("reports invalid events by index without blocking valid ones", async () => {
    const result = await importEvents([
      event("a"),
      event("b", { timeframe: "nope" }),
      { project: "p", timeframe: "1h" },
    ])
    expect(result.imported).toBe(1)
    expect(result.invalid).toEqual([
      { index: 1, error: expect.stringContaining("Invalid timeframe") },
      { index: 2, error: "Imported events need an id" },
    ])
  })

  it("writes nothing on a dry run but reports the counts", async () => {
    const result = await importEvents([event("a"), event("b")], { dryRun: true })
    expect(result.imported).toBe(2)
    expect((await listEvents()).total).toBe(0)
  })

  it("handles more than one batch", async () => {
    const many = Array.from({ length: 1234 }, (_, i) => event(`id-${i}`))
    expect((await importEvents(many)).imported).toBe(1234)
    expect((await listEvents({ pageSize: 1 })).total).toBe(1234)
  })
})
