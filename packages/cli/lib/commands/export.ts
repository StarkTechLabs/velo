import { writeFileSync } from "node:fs"

import { Config, eventsToCsv, listAllEvents } from "@starktech/core"
import { Command } from "commander"

import { addFilterOptions, filterFromOptions } from "@/options"
import { CommandRegistration } from "@/types"

export const exportCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    const command = program
      .command("export")
      .description("Export events as CSV (grouped by day, project and description) or JSON.")
      .option("-f, --format <format>", "csv or json", "csv")
      .option("-o, --output <file>", "Write to a file instead of stdout")
    addFilterOptions(command).action(async (options) => {
      if (!["csv", "json"].includes(options.format)) {
        program.error(`Unknown format "${options.format}". Use csv or json.`)
      }
      const events = await listAllEvents(filterFromOptions(options))
      const output =
        options.format === "json" ? JSON.stringify(events, null, 2) + "\n" : eventsToCsv(events)

      if (options.output) {
        writeFileSync(options.output, output)
        console.error(`Exported ${events.length} events to ${options.output}`)
      } else {
        process.stdout.write(output)
      }
    })
  },
}
