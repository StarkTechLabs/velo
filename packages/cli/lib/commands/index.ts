import { Config } from "@starktech/core"
import { Command } from "commander"

import { configureCommand } from "./configure"
import { initCommand } from "./init"
import { logCommand } from "./log"
import { projectsCommand } from "./projects"
import { statsCommand } from "./stats"

export const registerCommands = (program: Command, config: Config) => {
  configureCommand.register(program, config)
  logCommand.register(program, config)
  initCommand.register(program, config)
  statsCommand.register(program, config)
  projectsCommand.register(program, config)
}
