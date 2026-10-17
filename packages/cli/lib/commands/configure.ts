import { Config, configSchema, writeConfig } from "@starktech/core"
import { Command } from "commander"

import { SERVICE_ORDER } from "@/services/definitions"
import { serviceDeps } from "@/services/manage"
import { CommandRegistration } from "@/types"

export const configureCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    program
      .command("configure")
      .description("Get/set configuration settings for the velo cli.")
      .option("-l, --list", "List the current configuration")
      .option("--api-host <host>", "Address the API binds to (default 127.0.0.1)")
      .option("--api-port <port>", "Port the API listens on")
      .option("--dashboard-port <port>", "Port the dashboard listens on")
      .action((options, command: Command) => {
        const port = (value: string | undefined) =>
          value === undefined ? undefined : Number(value) || value // non-numeric input fails validation
        const updates = {
          apiHost: options.apiHost,
          apiPort: port(options.apiPort),
          dashboardPort: port(options.dashboardPort),
        }

        if (Object.values(updates).every((v) => v === undefined)) {
          if (options.list) console.log(JSON.stringify(config, null, 2))
          else command.help()
          return
        }

        const next = configSchema.parse({
          ...config,
          api: {
            host: updates.apiHost ?? config.api.host,
            port: updates.apiPort ?? config.api.port,
          },
          dashboard: { port: updates.dashboardPort ?? config.dashboard.port },
        })
        writeConfig(next)
        console.log(JSON.stringify(next, null, 2))
        console.log("\nRestart running services to apply: velo stop && velo start")
        const manager = serviceDeps.autostart()
        if (manager && SERVICE_ORDER.some((name) => manager.isInstalled(name))) {
          console.log("Autostart is set up: run `velo service install` so the login units match.")
        }
      })
  },
}
