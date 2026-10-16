import { Config, listEvents } from "@starktech/core"
import { Command } from "commander"

import { printJson, renderTable, formatWhen, shortId, truncate } from "@/format"
import { addFilterOptions, filterFromOptions } from "@/options"
import { CommandRegistration } from "@/types"

export const listCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    const command = program
      .command("list")
      .alias("ls")
      .description("List logged events, newest first.")
      .option("-n, --limit <count>", "Events per page", "20")
      .option("--page <number>", "Page number", "1")
      .option("--json", "Output JSON")
    addFilterOptions(command).action(async (options) => {
      const result = await listEvents({
        ...filterFromOptions(options),
        pageSize: options.limit,
        page: options.page,
      })

      if (options.json) return printJson(result)
      if (result.data.length === 0) return console.log("No events found.")

      console.log(
        renderTable(
          ["ID", "WHEN", "PROJECT", "TIME", "DESCRIPTION"],
          result.data.map((e) => [
            shortId(e.id),
            formatWhen(e.timestamp),
            e.project,
            e.timeframe,
            truncate(e.description, 60),
          ]),
        ),
      )
      const first = (result.page - 1) * result.pageSize + 1
      const last = first + result.data.length - 1
      console.log(`\nShowing ${first}-${last} of ${result.total}`)
      if (last < result.total) console.log(`Next page: velo list --page ${result.page + 1}`)
    })
  },
}
