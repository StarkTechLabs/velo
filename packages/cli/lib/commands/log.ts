import { Config, WorkEvent, insert, validateTimeframe } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const logCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    program
      .command("log <project> <timeframe> <event>")
      .description("Log an event to velo.")
      .option(
        "-u, --user <user_id>",
        "Save log for given user id. If not provided, it will leverage the default.",
      )
      .option(
        "--channel <channel_id>",
        "Save log for given channel id. If not provided, it will leverage the default.",
      )
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
        // validate timeframe
        const err = validateTimeframe(timeframe)
        if (err) {
          program.error(err as string)
        }

        const workEvent: WorkEvent = {
          project,
          timeframe,
          description: event,
          timestamp: options.timestamp || new Date().toISOString(),
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          channel: options.channel ?? null,
          userId: options.user || config.defaultUserId,
        }

        const id = await insert(workEvent)
        console.log(`Logged`)
        console.log(`  Project   : ${workEvent.project}`)
        console.log(`  Timeframe : ${workEvent.timeframe}`)
        console.log(`  Event     : ${workEvent.description}`)
      })
  },
}
