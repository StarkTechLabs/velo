import { Knex } from "knex"

interface MigrationSpec {
  name: string
}

const MIGRATIONS: MigrationSpec[] = [{ name: "001_create_work_event" }]

const MIGRATION_MAP: Record<string, Knex.Migration> = {
  "001_create_work_event": {
    async up(knex: Knex) {
      await knex.schema.createTable("work_event", (table) => {
        table.string("id").primary()
        table.timestamp("timestamp").notNullable().defaultTo(knex.fn.now())
        table.string("timeframe").notNullable()
        table.string("project").notNullable().defaultTo("")
        table.string("description").nullable()
        table.string("user_id").nullable()
        table.string("channel").nullable()
        table.text("meta").nullable().defaultTo("{}")
        table.timestamp("created").notNullable().defaultTo(knex.fn.now())
        table.timestamp("updated").notNullable().defaultTo(knex.fn.now())
        table.boolean("deleted").notNullable().defaultTo(false)
      })
    },
    async down(knex: Knex) {
      await knex.schema.dropTableIfExists("work_event")
    },
  },
}

export class EmbeddedMigrationSource implements Knex.MigrationSource<MigrationSpec> {
  async getMigrations(): Promise<MigrationSpec[]> {
    return MIGRATIONS
  }
  getMigrationName(migration: MigrationSpec): string {
    return migration.name
  }
  async getMigration(migration: MigrationSpec): Promise<Knex.Migration> {
    const m = MIGRATION_MAP[migration.name]
    if (!m) throw new Error(`Migration not found: ${migration.name}`)
    return m
  }
}
