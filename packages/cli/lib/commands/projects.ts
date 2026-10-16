import { Config, listProjects } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const projectsCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("projects")
      .description("List all projects with logged time.")
      .action(async () => {
        const projects = await listProjects()
        console.log(projects.length === 0 ? "No projects found." : projects.join("\n"))
      })
  },
}
