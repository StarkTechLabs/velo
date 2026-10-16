import { Config, UpdateEvent, resolveEventId, updateEvent } from "@starktech/core"
import { Command } from "commander"

import { formatWhen, printJson } from "@/format"
import { CommandRegistration } from "@/types"

export const editCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("edit <id>")
      .description("Edit an event. <id> is the full id or the ID column of `velo list`.")
      .option("-p, --project <name>", "New project")
      .option("-t, --timeframe <timeframe>", "New timeframe, e.g. 1.5h")
      .option("-d, --description <text>", "New description")
      .option("--timestamp <iso_timestamp>", "New timestamp")
      .option("--json", "Output JSON")
      .action(async (ref: string, options) => {
        const changes: UpdateEvent = {
          project: options.project,
          timeframe: options.timeframe,
          description: options.description,
          timestamp: options.timestamp,
        }
        if (Object.values(changes).every((v) => v === undefined)) {
          program.error(
            "Nothing to change. Pass at least one of --project, --timeframe, --description, --timestamp.",
          )
        }

        const id = await resolveEventId(ref)
        const event = await updateEvent(id, changes)
        if (!event) throw new Error(`No event found matching "${ref}"`)

        if (options.json) return printJson(event)
        console.log("Updated")
        console.log(`  Project   : ${event.project}`)
        console.log(`  Timeframe : ${event.timeframe}`)
        console.log(`  Event     : ${event.description}`)
        console.log(`  When      : ${formatWhen(event.timestamp)}`)
      })
  },
}
