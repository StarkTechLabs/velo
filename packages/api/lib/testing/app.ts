import { EmbeddedMigrationSource, getDb, setDb } from "@starktech/core"
import knex from "knex"

import { createApp } from "../app"

export const DASHBOARD_ORIGIN = "http://localhost:4318"

export const setupTestDb = async () => {
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  })
  await db.migrate.latest({ migrationSource: new EmbeddedMigrationSource() })
  setDb(db)
}

export const clearEvents = async () => {
  await getDb()("work_event").delete()
}

export const testApp = () =>
  createApp({
    version: "1.2.3",
    databaseFilePath: "/tmp/test.sqlite",
    allowedOrigins: [DASHBOARD_ORIGIN],
    log: () => {},
  })
