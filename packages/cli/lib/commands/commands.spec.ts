import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { closeDb, createEvent, listEvents, migratedMemoryDbForTests } from "@/testing/db"
import { runCli } from "@/testing/run"

let tmp: string

beforeAll(async () => {
  await migratedMemoryDbForTests()
})

afterAll(async () => {
  await closeDb()
})

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "velo-cli-"))
  const { getDb } = await import("@starktech/core")
  await getDb()("work_event").delete()
})

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }))

const seed = async () => {
  const a = await createEvent({
    id: "aaaaaaaa-1111",
    project: "alpha",
    timeframe: "1h",
    description: "first",
    timestamp: "2026-01-05T12:00:00.000Z",
  })
  const b = await createEvent({
    id: "bbbbbbbb-2222",
    project: "beta",
    timeframe: "30m",
    description: "second, with comma",
    timestamp: "2026-01-06T12:00:00.000Z",
  })
  return { a, b }
}

describe("log", () => {
  it("creates an event and prints a summary", async () => {
    const { out, failure } = await runCli(["log", "alpha", "1.5h", "did stuff"])
    expect(failure).toBeUndefined()
    expect(out).toContain("Project   : alpha")
    expect(out).toContain("Timeframe : 1.5h")
    expect((await listEvents()).total).toBe(1)
  })

  it("prints JSON with --json and honours --timestamp", async () => {
    const { out } = await runCli([
      "log",
      "a",
      "1h",
      "x",
      "--json",
      "--timestamp",
      "2026-02-01T10:00:00Z",
    ])
    expect(JSON.parse(out)).toMatchObject({
      project: "a",
      minutes: 60,
      timestamp: "2026-02-01T10:00:00.000Z",
    })
  })

  it("fails on an invalid timeframe", async () => {
    const { failure } = await runCli(["log", "a", "nope", "x"])
    expect(failure?.message).toContain("Invalid timeframe format")
    expect((await listEvents()).total).toBe(0)
  })
})

describe("list", () => {
  it("prints a table with short ids, newest first, and a footer", async () => {
    await seed()
    const { out } = await runCli(["list"])
    const lines = out.split("\n")
    expect(lines[0]).toMatch(/^ID\s+WHEN\s+PROJECT\s+TIME\s+DESCRIPTION/)
    expect(lines[2]).toContain("bbbb-2222".slice(-8))
    expect(lines[2]).toContain("beta")
    expect(out).toContain("Showing 1-2 of 2")
  })

  it("filters by project, search and dates", async () => {
    await seed()
    expect((await runCli(["list", "-p", "alpha"])).out).not.toContain("beta")
    expect((await runCli(["list", "-s", "comma"])).out).toContain("beta")
    expect(
      (await runCli(["list", "--from", "2026-01-06", "--to", "2026-01-06", "--json"])).out,
    ).toContain('"total": 1')
    expect((await runCli(["list", "-p", "alpha", "-p", "beta", "--json"])).out).toContain(
      '"total": 2',
    )
    expect((await runCli(["list", "--today"])).out).toBe("No events found.")
  })

  it("paginates", async () => {
    await seed()
    const { out } = await runCli(["list", "-n", "1"])
    expect(out).toContain("Showing 1-1 of 2")
    expect(out).toContain("velo list --page 2")
    expect((await runCli(["list", "-n", "1", "--page", "2"])).out).toContain("alpha")
  })

  it("rejects bad dates", async () => {
    const { failure } = await runCli(["list", "--from", "garbage"])
    expect(failure?.message).toContain('Invalid date "garbage"')
  })
})

describe("edit", () => {
  it("updates by id suffix and recomputes time", async () => {
    const { a } = await seed()
    const { out } = await runCli(["edit", "1111", "-t", "2h", "-d", "changed", "-p", "gamma"])
    expect(out).toContain("Updated")
    expect(await listEvents({ projects: ["gamma"] })).toMatchObject({ total: 1 })
    const [event] = (await listEvents({ projects: ["gamma"] })).data
    expect(event).toMatchObject({ id: a.id, minutes: 120, description: "changed" })
  })

  it("requires a change and an existing event", async () => {
    await seed()
    expect((await runCli(["edit", "1111"])).failure?.message).toContain("Nothing to change")
    expect((await runCli(["edit", "zzzz9", "-d", "x"])).failure?.message).toContain(
      "No event found",
    )
  })
})

describe("rm", () => {
  it("deletes with --yes", async () => {
    await seed()
    const { out } = await runCli(["rm", "1111", "--yes"])
    expect(out).toContain("Deleted")
    expect((await listEvents()).total).toBe(1)
  })

  it("refuses to prompt without a terminal", async () => {
    await seed()
    const { failure } = await runCli(["rm", "1111"])
    expect(failure?.message).toContain("Pass --yes")
    expect((await listEvents()).total).toBe(2)
  })
})

describe("projects and stats", () => {
  it("lists projects, as text or JSON", async () => {
    await seed()
    expect((await runCli(["projects"])).out).toBe("alpha\nbeta")
    expect(JSON.parse((await runCli(["projects", "--json"])).out)).toEqual(["alpha", "beta"])
    expect((await runCli(["projects"])).failure).toBeUndefined()
  })

  it("summarises any period by project, with the list filters", async () => {
    expect((await runCli(["stats", "summary"])).out).toBe("No events found.")
    await seed() // alpha 1h on 2026-01-05, beta 30m on 2026-01-06
    await createEvent({ project: "alpha", timeframe: "30m", timestamp: "2026-01-06T15:00:00.000Z" })

    const all = (await runCli(["stats", "summary"])).out
    expect(all).toContain("Total  2.00h  (3 events over 2 days)")
    expect(all).toMatch(/alpha\s+1\.50\s+2/)
    expect(all).toMatch(/beta\s+0\.50\s+1/)
    expect(all.indexOf("alpha")).toBeLessThan(all.indexOf("beta")) // most time first

    const filtered = (await runCli(["stats", "summary", "-p", "beta"])).out
    expect(filtered).toContain("Total  0.50h  (1 event over 1 day)")
    expect(filtered).not.toContain("alpha")

    const json = JSON.parse(
      (await runCli(["stats", "summary", "--from", "2026-01-06", "--json"])).out,
    )
    expect(json).toMatchObject({ totalMinutes: 60, eventCount: 2 })
  })

  it("reports today's stats", async () => {
    expect((await runCli(["stats", "today"])).out).toContain("No events logged today.")
    await createEvent({ project: "p", timeframe: "90m", description: "now" })
    const { out } = await runCli(["stats", "today"])
    expect(out).toContain("Total     1.5h  (1 event)")
    const json = JSON.parse((await runCli(["stats", "today", "--json"])).out)
    expect(json).toMatchObject({ totalMinutes: 90, last: { project: "p" } })
  })
})

describe("export and import", () => {
  it("exports CSV to stdout and JSON to a file", async () => {
    await seed()
    const csv = (await runCli(["export"])).out
    expect(csv).toContain("date,project,description,hours")
    expect(csv).toContain('"second, with comma",0.50')

    const file = path.join(tmp, "out.json")
    await runCli(["export", "-f", "json", "-p", "alpha", "-o", file])
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toHaveLength(1)
    expect((await runCli(["export", "-f", "xml"])).failure?.message).toContain("Unknown format")
  })

  it("round-trips through import csv, idempotently, with --dry-run", async () => {
    await seed()
    const file = path.join(tmp, "out.csv")
    await runCli(["export", "-o", file])
    const { getDb } = await import("@starktech/core")
    await getDb()("work_event").delete()

    expect((await runCli(["import", "csv", file, "--dry-run"])).out).toBe(
      "Would import 2 events, 0 already present",
    )
    expect((await listEvents()).total).toBe(0)
    expect((await runCli(["import", "csv", file])).out).toBe("Imported 2 events, 0 already present")
    expect((await runCli(["import", "csv", file])).out).toBe("Imported 0 events, 2 already present")
    expect((await listEvents()).total).toBe(2)
  })

  it("reports bad rows but imports the rest", async () => {
    const file = path.join(tmp, "bad.csv")
    fs.writeFileSync(file, "date,project,description,hours\n2026-01-01,a,x,1\nnope,a,x,1\n")
    const { out, err } = await runCli(["import", "csv", file])
    expect(out).toBe("Imported 1 events, 0 already present")
    expect(err).toContain('line 3: Invalid date "nope"')
  })

  it("requires a postgres url", async () => {
    const saved = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    const { failure } = await runCli(["import", "postgres"])
    expect(failure?.message).toContain("DATABASE_URL")
    if (saved) process.env.DATABASE_URL = saved
  })
})
