import { Knex } from "knex"

interface MigrationSpec {
  name: string
}

const MIGRATIONS: MigrationSpec[] = [
  { name: "001_create_work_event" },
  { name: "002_single_user_minutes" },
]

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
  // Single-user schema: drops user_id/channel/meta, stores minutes for SQL aggregation,
  // and adds indexes. SQLite can't alter these in place so the table is rebuilt.
  "002_single_user_minutes": {
    async up(knex: Knex) {
      await knex.raw(`
        CREATE TABLE work_event_new (
          id varchar(255) NOT NULL PRIMARY KEY,
          timestamp datetime NOT NULL,
          timeframe varchar(255) NOT NULL,
          minutes float NOT NULL,
          project varchar(255) NOT NULL DEFAULT '',
          description text NOT NULL DEFAULT '',
          created datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted boolean NOT NULL DEFAULT 0
        )`)
      await knex.raw(`
        INSERT INTO work_event_new
          (id, timestamp, timeframe, minutes, project, description, created, updated, deleted)
        SELECT id, timestamp, timeframe,
          CAST(substr(timeframe, 1, length(timeframe) - 1) AS REAL) *
            CASE substr(timeframe, -1) WHEN 'h' THEN 60 WHEN 'd' THEN 1440 ELSE 1 END,
          project, coalesce(description, ''), created, updated, deleted
        FROM work_event`)
      await knex.raw("DROP TABLE work_event")
      await knex.raw("ALTER TABLE work_event_new RENAME TO work_event")
      await knex.raw("CREATE INDEX work_event_deleted_timestamp ON work_event (deleted, timestamp)")
      await knex.raw("CREATE INDEX work_event_project ON work_event (project)")
    },
    async down(knex: Knex) {
      await knex.raw(`
        CREATE TABLE work_event_old (
          id varchar(255) NOT NULL PRIMARY KEY,
          timestamp datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          timeframe varchar(255) NOT NULL,
          project varchar(255) NOT NULL DEFAULT '',
          description varchar(255),
          user_id varchar(255),
          channel varchar(255),
          meta text DEFAULT '{}',
          created datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
          deleted boolean NOT NULL DEFAULT 0
        )`)
      await knex.raw(`
        INSERT INTO work_event_old (id, timestamp, timeframe, project, description, created, updated, deleted)
        SELECT id, timestamp, timeframe, project, description, created, updated, deleted FROM work_event`)
      await knex.raw("DROP TABLE work_event")
      await knex.raw("ALTER TABLE work_event_old RENAME TO work_event")
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
