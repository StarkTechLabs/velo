import { getDb, setDb } from "@/common/db"
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  listProjects,
  updateEvent,
} from "@/data/workEvent"
import { migratedMemoryDb } from "@/testing/memoryDb"

beforeAll(async () => {
  setDb(await migratedMemoryDb())
})

afterAll(async () => {
  await getDb().destroy()
})

beforeEach(async () => {
  await getDb()("work_event").delete()
})

const base = {
  project: "test-project",
  timeframe: "1h",
  description: "did some work",
  timestamp: "2026-01-15T10:00:00.000Z",
}

describe("createEvent", () => {
  it("returns the stored event with minutes computed", async () => {
    const event = await createEvent({ ...base, timeframe: "1.5h" })
    expect(event).toMatchObject({ ...base, timeframe: "1.5h", minutes: 90 })
    expect(event.id.length).toBeGreaterThan(0)
    expect(event.created).toBe(event.updated)
  })

  it("defaults timestamp to now and description to empty", async () => {
    const before = Date.now()
    const event = await createEvent({ project: "p", timeframe: "30m" })
    expect(event.description).toBe("")
    expect(new Date(event.timestamp).getTime()).toBeGreaterThanOrEqual(before)
  })

  it("normalizes timestamps to UTC ISO", async () => {
    const event = await createEvent({ ...base, timestamp: "2026-01-15T05:00:00-05:00" })
    expect(event.timestamp).toBe("2026-01-15T10:00:00.000Z")
  })

  it("uses a provided id", async () => {
    const event = await createEvent({ ...base, id: "custom-id" })
    expect(event.id).toBe("custom-id")
  })

  it.each(["", "abc", "1x", "0h", "-1h"])("rejects timeframe %p", async (timeframe) => {
    await expect(createEvent({ ...base, timeframe })).rejects.toThrow()
  })

  it("rejects an empty project and a bad timestamp", async () => {
    await expect(createEvent({ ...base, project: "  " })).rejects.toThrow("Project is required")
    await expect(createEvent({ ...base, timestamp: "nope" })).rejects.toThrow("Invalid timestamp")
  })
})

describe("listEvents", () => {
  beforeEach(async () => {
    await createEvent({ ...base, project: "alpha", description: "wrote tests" })
    await createEvent({ ...base, project: "beta", description: "fixed bug" })
    await createEvent({ ...base, project: "alpha", description: "reviewed PR" })
  })

  it("returns all events with paging info", async () => {
    const result = await listEvents()
    expect(result).toMatchObject({ total: 3, page: 1, pageSize: 20 })
    expect(result.data).toHaveLength(3)
  })

  it("filters by term in project or description, case-insensitively", async () => {
    expect((await listEvents({ term: "ALPHA" })).total).toBe(2)
    const bug = await listEvents({ term: "bug" })
    expect(bug.data.map((e) => e.project)).toEqual(["beta"])
  })

  it("filters by project list", async () => {
    expect((await listEvents({ projects: ["beta"] })).total).toBe(1)
  })

  it("filters by date range", async () => {
    await createEvent({ ...base, timestamp: "2026-02-01T10:00:00.000Z" })
    const result = await listEvents({
      minDate: "2026-02-01T00:00:00.000Z" as unknown as Date,
      maxDate: new Date("2026-02-02T00:00:00.000Z"),
    })
    expect(result.total).toBe(1)
  })

  it("paginates and reports the full total", async () => {
    const result = await listEvents({ page: 2, pageSize: 2 })
    expect(result.total).toBe(3)
    expect(result.data).toHaveLength(1)
  })

  it("orders newest first", async () => {
    await createEvent({ ...base, project: "newest", timestamp: "2026-03-01T00:00:00.000Z" })
    expect((await listEvents()).data[0].project).toBe("newest")
  })

  it("excludes deleted events", async () => {
    const event = await createEvent({ ...base, project: "gone" })
    await deleteEvent(event.id)
    expect((await listEvents()).total).toBe(3)
  })

  it("rejects an invalid page size", async () => {
    await expect(listEvents({ pageSize: 0 })).rejects.toThrow()
  })
})

describe("getEvent", () => {
  it("returns the event, or null when missing or deleted", async () => {
    const event = await createEvent(base)
    expect(await getEvent(event.id)).toEqual(event)
    expect(await getEvent("missing")).toBeNull()
    await deleteEvent(event.id)
    expect(await getEvent(event.id)).toBeNull()
  })
})

describe("listProjects", () => {
  it("returns distinct, case-insensitively sorted, non-deleted projects", async () => {
    await createEvent({ ...base, project: "zebra" })
    await createEvent({ ...base, project: "Apple" })
    await createEvent({ ...base, project: "apple2" })
    await createEvent({ ...base, project: "Apple" })
    const gone = await createEvent({ ...base, project: "gone" })
    await deleteEvent(gone.id)
    expect(await listProjects()).toEqual(["Apple", "apple2", "zebra"])
  })
})

describe("updateEvent", () => {
  it("updates only the given fields and returns the event", async () => {
    const event = await createEvent(base)
    const updated = await updateEvent(event.id, { description: "new", project: "other" })
    expect(updated).toMatchObject({
      id: event.id,
      description: "new",
      project: "other",
      timeframe: "1h",
      minutes: 60,
      created: event.created,
    })
  })

  it("recomputes minutes when the timeframe changes", async () => {
    const event = await createEvent(base)
    expect((await updateEvent(event.id, { timeframe: "2d" }))?.minutes).toBe(2880)
  })

  it("bumps the updated timestamp", async () => {
    const event = await createEvent(base)
    await getDb()("work_event")
      .where({ id: event.id })
      .update({ updated: "2020-01-01T00:00:00.000Z" })
    const updated = await updateEvent(event.id, { description: "x" })
    expect(updated?.updated).not.toBe("2020-01-01T00:00:00.000Z")
  })

  it("returns null for a missing or deleted event", async () => {
    expect(await updateEvent("missing", { description: "x" })).toBeNull()
    const event = await createEvent(base)
    await deleteEvent(event.id)
    expect(await updateEvent(event.id, { description: "x" })).toBeNull()
  })

  it("rejects invalid values", async () => {
    const event = await createEvent(base)
    await expect(updateEvent(event.id, { timeframe: "bad" })).rejects.toThrow()
  })
})

describe("deleteEvent", () => {
  it("soft-deletes and keeps the row", async () => {
    const event = await createEvent(base)
    expect(await deleteEvent(event.id)).toBe(true)
    const row = await getDb()("work_event").where({ id: event.id }).first()
    expect(row.deleted).toBe(1)
  })

  it("returns false for a missing or already deleted event", async () => {
    expect(await deleteEvent("missing")).toBe(false)
    const event = await createEvent(base)
    await deleteEvent(event.id)
    expect(await deleteEvent(event.id)).toBe(false)
  })
})
