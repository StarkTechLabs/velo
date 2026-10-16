import knex, { Knex } from "knex"

import { EmbeddedMigrationSource } from "@/migrations"

export const createMemoryDb = (): Knex =>
  knex({
    client: "better-sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
  })

export const migratedMemoryDb = async (): Promise<Knex> => {
  const db = createMemoryDb()
  await db.migrate.latest({ migrationSource: new EmbeddedMigrationSource() })
  return db
}
