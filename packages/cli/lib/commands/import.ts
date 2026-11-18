import { readFileSync } from "node:fs"

import { Config, ImportResult, csvToEvents, importEvents } from "@starktech/core"
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

export const importCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    const importCmd = program.command("import").description("Import events from CSV.")

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
  },
}
