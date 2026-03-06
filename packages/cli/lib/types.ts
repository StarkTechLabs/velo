import { Config } from "@starktech/core"
import { Command } from "commander"

export interface CommandRegistration {
  register(program: Command, config: Config): void
}
