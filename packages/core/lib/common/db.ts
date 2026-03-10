import knex, { Knex } from "knex"

import { Config } from "@/common/config"
import { EmbeddedMigrationSource } from "@/migrations"

let _db: Knex | null = null

export async function initDb(config: Config): Promise<void> {
  if (_db) return
  _db = knex({
    client: "better-sqlite3",
    connection: { filename: config.databaseFilePath },
    useNullAsDefault: true,
  })
  await _db.migrate.latest({ migrationSource: new EmbeddedMigrationSource() })
}

export function getDb(): Knex {
  if (!_db) throw new Error("Database not initialized. Call initDb(config) first.")
  return _db
}

export function setDb(instance: Knex): void {
  _db = instance
}
