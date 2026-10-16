import { readFileSync } from "node:fs"

import {
  BusybeeRow,
  Config,
  CreateEvent,
  ImportResult,
  busybeeRowToEvent,
  csvToEvents,
  importEvents,
} from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

const report = (result: ImportResult, dryRun: boolean, extra: string[] = []) => {
  const lines = [...extra]
  for (const { index, error } of result.invalid) lines.push(`  skipped #${index + 1}: ${error}`)
  lines.forEach((l) => console.error(l))
  console.log(
    `${dryRun ? "Would import" : "Imported"} ${result.imported} events` +
      `, ${result.skipped} already present` +
      (result.invalid.length ? `, ${result.invalid.length} invalid` : ""),
  )
}

const readBusybeePostgres = async (url: string, userId?: string): Promise<BusybeeRow[]> => {
  let pg: typeof import("pg").default
  try {
    pg = (await import("pg")).default
  } catch {
    throw new Error("Postgres import needs the optional 'pg' package. Run: npm install pg")
  }
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows } = await client.query<BusybeeRow>(
      `select id, timestamp, timeframe, project, description
         from work_event
        where deleted is not true ${userId ? "and user_id = $1" : ""}
        order by timestamp`,
      userId ? [userId] : [],
    )
    return rows
  } finally {
    await client.end()
  }
}

export const importCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    const importCmd = program
      .command("import")
      .description("Import events from CSV or a busybee-x Postgres database.")

    importCmd
      .command("csv <file>")
      .description(
        "Import a CSV from `velo export`, busybee-x's Export to CSV, or the Busywork log.",
      )
      .option("--dry-run", "Show what would be imported without writing")
      .action(async (file: string, options) => {
        const { events, errors } = csvToEvents(readFileSync(file, "utf8"))
        const result = await importEvents(events, { dryRun: options.dryRun })
        report(
          result,
          options.dryRun,
          errors.map((e) => `  line ${e.line}: ${e.error}`),
        )
      })

    importCmd
      .command("postgres [url]")
      .description("Import work events from a busybee-x Postgres database (or $DATABASE_URL).")
      .option("--user-id <id>", "Only events for this user_id")
      .option("--dry-run", "Show what would be imported without writing")
      .action(async (url: string | undefined, options) => {
        const connection = url ?? process.env.DATABASE_URL
        if (!connection) program.error("Pass a connection url or set DATABASE_URL.")

        const rows = await readBusybeePostgres(connection, options.userId)
        const events: CreateEvent[] = []
        const problems: string[] = []
        for (const row of rows) {
          try {
            events.push(busybeeRowToEvent(row))
          } catch (err) {
            problems.push(`  ${row.id}: ${(err as Error).message}`)
          }
        }
        report(await importEvents(events, { dryRun: options.dryRun }), options.dryRun, problems)
      })
  },
}
