import { Config, deleteEvent, getEvent, resolveEventId } from "@starktech/core"
import { Command } from "commander"

import { formatWhen } from "@/format"
import { confirm } from "@/prompt"
import { CommandRegistration } from "@/types"

export const rmCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("rm <id>")
      .alias("remove")
      .description("Delete an event. <id> is the full id or the ID column of `velo list`.")
      .option("-y, --yes", "Don't ask for confirmation")
      .action(async (ref: string, options) => {
        const id = await resolveEventId(ref)
        const event = await getEvent(id)
        if (!event) throw new Error(`No event found matching "${ref}"`)

        const summary = `${formatWhen(event.timestamp)}  ${event.project}  ${event.timeframe}  ${event.description}`
        if (!options.yes) {
          if (!process.stdin.isTTY)
            program.error("Not a terminal. Pass --yes to delete without asking.")
          if (!(await confirm(`Delete "${summary}"?`))) return console.log("Cancelled.")
        }

        await deleteEvent(id)
        console.log(`Deleted ${summary}`)
      })
  },
}
