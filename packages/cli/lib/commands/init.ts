import { Config, ensureConfig } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const initCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("init")
      .description("Initialize the cli tool.")
      .action((_options) => {
        ensureConfig()
        console.log("CLI initialized 🎉")
      })
  },
}
