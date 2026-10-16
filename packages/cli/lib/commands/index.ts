import { Config } from "@starktech/core"
import { Command } from "commander"

import { configureCommand } from "./configure"
import { editCommand } from "./edit"
import { exportCommand } from "./export"
import { importCommand } from "./import"
import { initCommand } from "./init"
import { listCommand } from "./list"
import { logCommand } from "./log"
import { projectsCommand } from "./projects"
import { rmCommand } from "./rm"
import { servicesCommand } from "./services"
import { statsCommand } from "./stats"

export const registerCommands = (program: Command, config: Config) => {
  configureCommand.register(program, config)
  initCommand.register(program, config)
  logCommand.register(program, config)
  listCommand.register(program, config)
  editCommand.register(program, config)
  rmCommand.register(program, config)
  statsCommand.register(program, config)
  projectsCommand.register(program, config)
  exportCommand.register(program, config)
  importCommand.register(program, config)
  servicesCommand.register(program, config)
}
