import { Config } from "@starktech/core"
import { Command } from "commander"

import { configureCommand } from "./configure"
import { initCommand } from "./init"
import { logCommand } from "./log"

export const registerCommands = (program: Command, config: Config) => {
  configureCommand.register(program, config)
  logCommand.register(program, config)
  initCommand.register(program, config)
}
