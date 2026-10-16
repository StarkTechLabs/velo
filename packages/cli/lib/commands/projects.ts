import { Config, listProjects } from "@starktech/core"
import { Command } from "commander"

import { printJson } from "@/format"
import { CommandRegistration } from "@/types"

export const projectsCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    program
      .command("projects")
      .description("List all projects with logged time.")
      .option("--json", "Output JSON")
      .action(async (options) => {
        const projects = await listProjects()
        if (options.json) return printJson(projects)
        console.log(projects.length === 0 ? "No projects found." : projects.join("\n"))
      })
  },
}
