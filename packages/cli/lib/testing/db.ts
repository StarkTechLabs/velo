import { EmbeddedMigrationSource, closeDb, createEvent, listEvents, setDb } from "@starktech/core"
import knex from "knex"

export { closeDb, createEvent, listEvents }

/** Points core at a fresh in-memory database with all migrations applied. */
export const migratedMemoryDbForTests = async () => {
  const db = knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  })
  await db.migrate.latest({ migrationSource: new EmbeddedMigrationSource() })
  setDb(db)
}
