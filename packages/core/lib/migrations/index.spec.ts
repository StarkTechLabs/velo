import { EmbeddedMigrationSource } from "."
import { createMemoryDb } from "../testing/memoryDb"

describe("migration 002_single_user_minutes", () => {
  it("upgrades existing rows, computing minutes and dropping user columns", async () => {
    const db = createMemoryDb()
    const migrationSource = new EmbeddedMigrationSource()
    await db.migrate.up({ migrationSource }) // 001

    const row = {
      timestamp: "2026-01-10T12:00:00.000Z",
      project: "p",
      user_id: "u",
      channel: "c",
      deleted: false,
    }
    await db("work_event").insert([
      { ...row, id: "1", timeframe: "1.5h", description: "a" },
      { ...row, id: "2", timeframe: "30m", description: null },
      { ...row, id: "3", timeframe: "2d", description: "c", deleted: true },
    ])

    await db.migrate.up({ migrationSource }) // 002

    const rows = await db("work_event").orderBy("id")
    expect(rows.map((r) => [r.id, r.minutes, r.description, Boolean(r.deleted)])).toEqual([
      ["1", 90, "a", false],
      ["2", 30, "", false],
      ["3", 2880, "c", true],
    ])
    const columns = Object.keys(rows[0])
    expect(columns).not.toEqual(expect.arrayContaining(["user_id"]))
    expect(columns).not.toEqual(expect.arrayContaining(["channel"]))
    expect(columns).not.toEqual(expect.arrayContaining(["meta"]))
    await db.destroy()
  })

  it("can be rolled back", async () => {
    const db = createMemoryDb()
    const migrationSource = new EmbeddedMigrationSource()
    await db.migrate.latest({ migrationSource })
    await db("work_event").insert({ id: "1", timestamp: "t", timeframe: "1h", minutes: 60 })
    await db.migrate.down({ migrationSource })
    const [row] = await db("work_event")
    expect(row).toMatchObject({ id: "1", timeframe: "1h", user_id: null })
    await db.destroy()
  })
})
