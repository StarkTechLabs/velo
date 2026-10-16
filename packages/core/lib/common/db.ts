import * as fs from "fs"
import * as path from "path"
import knex, { Knex } from "knex"

import { Config } from "@/common/config"
import { EmbeddedMigrationSource } from "@/migrations"

let _db: Knex | null = null

export async function initDb(config: Pick<Config, "databaseFilePath">): Promise<void> {
  if (_db) return
  fs.mkdirSync(path.dirname(config.databaseFilePath), { recursive: true })
  _db = knex({
    client: "better-sqlite3",
    connection: { filename: config.databaseFilePath },
    useNullAsDefault: true,
    pool: {
      // WAL + busy timeout let the cli and api share one database file without lock errors
      afterCreate: (
        conn: { pragma: (sql: string) => unknown },
        done: (err: Error | null, conn: unknown) => void,
      ) => {
        conn.pragma("journal_mode = WAL")
        conn.pragma("busy_timeout = 5000")
        done(null, conn)
      },
    },
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

export async function closeDb(): Promise<void> {
  const db = _db
  _db = null
  await db?.destroy()
}
