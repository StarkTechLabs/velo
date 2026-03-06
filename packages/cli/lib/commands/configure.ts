import { Config } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const configureCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    // const listCmd = command("list").description("List the current configuration")
    program
      .command("configure")
      // .addCommand("list", "List the current configuration")
      // .option("-e, --endpoint <endpoint>", "Set the endpoint for the velo work log webhook")
      // .option("-a, --apiKey <apiKey>", "Set the API key for the velo endpoint")
      // .option("-u, --userId <userId>", "Set the user id for current user")
      .option("-l, --list", "List the current configuration")
      .description("Get/set configuration settings for the velo cli.")
      .action((options) => {
        if (options.list) {
          console.log(config)
        } else {
          program.help()
        }
      })
  },
}
