import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { closeDb, getDb, initDb } from "./db"

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-db-"))
})

afterEach(async () => {
  await closeDb()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("initDb", () => {
  it("creates missing directories, migrates, and enables WAL", async () => {
    const filename = path.join(dir, "nested", "db.sqlite")
    await initDb({ databaseFilePath: filename })

    expect(fs.existsSync(filename)).toBe(true)
    expect(await getDb()("work_event").count({ count: "*" })).toEqual([{ count: 0 }])
    const [{ journal_mode }] = await getDb().raw("pragma journal_mode")
    expect(journal_mode).toBe("wal")
  })

  it("is idempotent, and getDb throws after closeDb", async () => {
    await initDb({ databaseFilePath: path.join(dir, "db.sqlite") })
    const db = getDb()
    await initDb({ databaseFilePath: path.join(dir, "other.sqlite") })
    expect(getDb()).toBe(db)

    await closeDb()
    expect(() => getDb()).toThrow("Database not initialized")
  })
})
