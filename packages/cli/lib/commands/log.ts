import { Config, createEvent, errorMessage } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const logCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("log <project> <timeframe> <event>")
      .description("Log an event to velo.")
      .option(
        "--timestamp <iso_timestamp>",
        "Save log with given timestamp. If not provided, it will default to `now`",
      )
      .addHelpText("after", "\n")
      .addHelpText(
        "after",
        "<project> should be the simple name of the project you are working on.",
      )
      .addHelpText(
        "after",
        "<timeframe> Expected format: <number><unit> where unit is m(minute), h(hour), or d(day).",
      )
      .addHelpText("after", "<event> is the description or task that was worked on.")
      .action(async (project: string, timeframe: string, event: string, options) => {
        let workEvent
        try {
          workEvent = await createEvent({
            project,
            timeframe,
            description: event,
            timestamp: options.timestamp,
          })
        } catch (err) {
          program.error(errorMessage(err))
        }

        console.log(`Logged`)
        console.log(`  Project   : ${workEvent.project}`)
        console.log(`  Timeframe : ${workEvent.timeframe}`)
        console.log(`  Event     : ${workEvent.description}`)
      })
  },
}
