import { Config, fetchProjects } from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

export const projectsCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    program
      .command("projects")
      .description("List all projects with logged time.")
      .action(async () => {
        const results = await fetchProjects({ userId: config.defaultUserId })

        if (results.length === 0) {
          console.log("No projects found.")
          return
        }

        const projects: string[] = results
          .sort((a: { project: string }, b: { project: string }) =>
            a.project.localeCompare(b.project),
          )
          .map((result: { project: string }) => result.project)

        console.log(projects.join("\n"))
      })
  },
}
