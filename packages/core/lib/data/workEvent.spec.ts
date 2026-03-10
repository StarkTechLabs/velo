import knex from "knex"

import { EmbeddedMigrationSource } from "@/migrations"
import { getDb, setDb } from "@/common/db"
import { insert, fetchPaginated, fetchProjects, remove, update } from "@/data/workEvent"

beforeAll(async () => {
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  })
  await db.migrate.latest({ migrationSource: new EmbeddedMigrationSource() })
  setDb(db)
})

afterAll(async () => {
  await getDb().destroy()
})

beforeEach(async () => {
  await getDb()("work_event").delete()
})

const baseEvent = {
  project: "test-project",
  timeframe: "1h",
  description: "did some work",
  timestamp: "2026-01-15T10:00:00.000Z",
  created: "2026-01-15T10:00:00.000Z",
  updated: "2026-01-15T10:00:00.000Z",
  channel: null,
  userId: "user-1",
}

describe("insert", () => {
  it("returns an id string", async () => {
    const id = await insert(baseEvent)
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })

  it("stores timeframe as a string", async () => {
    const id = await insert(baseEvent)
    const row = await getDb()("work_event").where({ id }).first()
    expect(row.timeframe).toBe("1h")
  })

  it("stores meta as a JSON string", async () => {
    const id = await insert(baseEvent)
    const row = await getDb()("work_event").where({ id }).first()
    expect(typeof row.meta).toBe("string")
    expect(() => JSON.parse(row.meta)).not.toThrow()
  })

  it("uses provided id if given", async () => {
    const id = await insert({ ...baseEvent, id: "custom-id-123" })
    expect(id).toBe("custom-id-123")
    const row = await getDb()("work_event").where({ id: "custom-id-123" }).first()
    expect(row).toBeDefined()
  })
})

describe("fetchPaginated", () => {
  beforeEach(async () => {
    await insert({ ...baseEvent, project: "alpha", description: "wrote tests", userId: "user-1" })
    await insert({ ...baseEvent, project: "beta", description: "fixed bug", userId: "user-1" })
    await insert({ ...baseEvent, project: "alpha", description: "reviewed PR", userId: "user-1" })
    await insert({ ...baseEvent, project: "gamma", description: "deploy", userId: "user-2" })
  })

  it("returns all events for a user", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-1" })
    expect(total).toBe(3)
    expect(data).toHaveLength(3)
  })

  it("filters by search term (project)", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-1", term: "alpha" })
    expect(total).toBe(2)
    expect(data.every((e) => e.project === "alpha")).toBe(true)
  })

  it("filters by search term (description)", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-1", term: "bug" })
    expect(total).toBe(1)
    expect(data[0].project).toBe("beta")
  })

  it("filters by project list", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-1", projects: ["beta"] })
    expect(total).toBe(1)
    expect(data[0].project).toBe("beta")
  })

  it("paginates results", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-1", page: 1, pageSize: 2 })
    expect(total).toBe(3)
    expect(data).toHaveLength(2)
  })

  it("excludes deleted events", async () => {
    const id = await insert({ ...baseEvent, project: "deleted-project", userId: "user-1" })
    await remove(id)
    const { total } = await fetchPaginated({ userId: "user-1" })
    expect(total).toBe(3)
  })

  it("isolates by userId", async () => {
    const { data, total } = await fetchPaginated({ userId: "user-2" })
    expect(total).toBe(1)
    expect(data[0].project).toBe("gamma")
  })
})

describe("fetchProjects", () => {
  beforeEach(async () => {
    await insert({ ...baseEvent, project: "zebra", userId: "user-1" })
    await insert({ ...baseEvent, project: "apple", userId: "user-1" })
    await insert({ ...baseEvent, project: "apple", userId: "user-1" })
    await insert({ ...baseEvent, project: "mango", userId: "user-2" })
  })

  it("returns distinct projects sorted ascending", async () => {
    const results = await fetchProjects({ userId: "user-1" })
    const names = results.map((r) => r.project)
    expect(names).toEqual(["apple", "zebra"])
  })

  it("excludes deleted events", async () => {
    const id = await insert({ ...baseEvent, project: "gone", userId: "user-1" })
    await remove(id)
    const results = await fetchProjects({ userId: "user-1" })
    const names = results.map((r) => r.project)
    expect(names).not.toContain("gone")
  })

  it("isolates by userId", async () => {
    const results = await fetchProjects({ userId: "user-2" })
    const names = results.map((r) => r.project)
    expect(names).toEqual(["mango"])
  })
})

describe("remove", () => {
  it("soft-deletes an event", async () => {
    const id = await insert(baseEvent)
    await remove(id)
    const row = await getDb()("work_event").where({ id }).first()
    expect(row.deleted).toBe(1) // SQLite stores booleans as integers
  })

  it("does not physically delete the row", async () => {
    const id = await insert(baseEvent)
    await remove(id)
    const row = await getDb()("work_event").where({ id }).first()
    expect(row).toBeDefined()
  })
})

describe("update", () => {
  it("returns the id", async () => {
    const id = await insert(baseEvent)
    const result = await update(id, { description: "updated description" })
    expect(result).toBe(id)
  })

  it("updates specified fields", async () => {
    const id = await insert(baseEvent)
    await update(id, { description: "new desc", project: "new-project" })
    const row = await getDb()("work_event").where({ id }).first()
    expect(row.description).toBe("new desc")
    expect(row.project).toBe("new-project")
  })

  it("does not change created timestamp", async () => {
    const id = await insert(baseEvent)
    const before = await getDb()("work_event").where({ id }).first()
    await update(id, { description: "changed" })
    const after = await getDb()("work_event").where({ id }).first()
    expect(after.created).toBe(before.created)
  })

  it("updates the updated timestamp", async () => {
    const id = await insert({ ...baseEvent, updated: "2020-01-01T00:00:00.000Z" })
    await update(id, { description: "changed" })
    const row = await getDb()("work_event").where({ id }).first()
    expect(row.updated).not.toBe("2020-01-01T00:00:00.000Z")
  })

  it("does not overwrite id or deleted", async () => {
    const id = await insert(baseEvent)
    await update(id, { description: "changed" })
    const row = await getDb()("work_event").where({ id }).first()
    expect(row.id).toBe(id)
    expect(row.deleted).toBe(0)
  })
})
