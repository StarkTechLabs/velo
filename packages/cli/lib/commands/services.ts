import * as fs from "node:fs"

import { Config, versionsCompatible } from "@starktech/core"
import { Command } from "commander"

import { printJson, renderTable } from "@/format"
import { browser } from "@/services/browser"
import { SERVICES, SERVICE_ORDER, ServiceName } from "@/services/definitions"
import { logFile, tailFile } from "@/services/files"
import {
  ServiceStatus,
  getAllStatuses,
  getStatus,
  serviceDeps,
  startService,
  stopService,
} from "@/services/manage"
import { CommandRegistration } from "@/types"

const describe = (s: ServiceStatus): string => {
  if (s.state === "running") return `running   ${s.url}   pid ${s.pid}   v${s.version}`
  if (s.state === "conflict") return `conflict  ${s.detail}`
  return s.installed ? `stopped   ${s.url}` : "not installed"
}

const printStatuses = (statuses: ServiceStatus[]) =>
  console.log(
    renderTable(
      ["SERVICE", "STATE"],
      statuses.map((s) => [s.label, describe(s)]),
    ),
  )

const start = async (name: ServiceName, config: Config): Promise<void> => {
  const label = SERVICES[name].label
  const result = await startService(name, config)
  console.log(
    result.status === "started"
      ? `${label} started at ${result.url} (pid ${result.pid}${result.via ? `, by ${result.via}` : ""})`
      : `${label} already running at ${result.url} (pid ${result.pid})`,
  )
  if (result.status === "started") console.log(`Logs: velo ${name} logs`)
}

/** Dashboard needs the API, so make sure it is up first (unless told not to). */
const startWithDependencies = async (
  name: ServiceName,
  config: Config,
  { api = true }: { api?: boolean } = {},
) => {
  if (name === "dashboard") {
    // fail before side effects: don't start the API for a dashboard that can't start
    const status = await getStatus(name, config)
    if (!status.installed && status.state !== "running") {
      serviceDeps.resolveBin(SERVICES[name]) // throws NotInstalledError with install instructions
    }
    if (api) await start("api", config)
  }
  await start(name, config)
}

const stop = async (name: ServiceName, config: Config): Promise<void> => {
  const label = SERVICES[name].label
  const result = await stopService(name, config)
  console.log(result === "stopped" ? `${label} stopped` : `${label} is not running`)
}

const follow = (file: string, from: number): Promise<never> => {
  let position = from
  fs.watchFile(file, { interval: 300 }, (current) => {
    if (current.size < position) position = 0 // rotated or truncated
    if (current.size === position) return
    const fd = fs.openSync(file, "r")
    try {
      const buffer = Buffer.alloc(current.size - position)
      fs.readSync(fd, buffer, 0, buffer.length, position)
      process.stdout.write(buffer)
    } finally {
      fs.closeSync(fd)
    }
    position = current.size
  })
  return new Promise<never>(() => {})
}

/** Warns when a running service is a different (incompatible) version from this CLI. */
const versionWarnings = (statuses: ServiceStatus[]): string[] => {
  const cli = serviceDeps.cliVersion()
  const stale = statuses.filter((s) => s.version && !versionsCompatible(cli, s.version))
  if (stale.length === 0) return []
  const packages = stale.map((s) => SERVICES[s.name].packageName)
  return [
    "",
    ...stale.map((s) => `warning: the ${s.label} is v${s.version} but this velo is v${cli}.`),
    `They are released together; update them together: npm install -g @starktech/velo@latest ${packages.map((p) => `${p}@latest`).join(" ")}`,
    "then restart the services: velo stop && velo start",
  ]
}

const registerServiceGroup = (program: Command, name: ServiceName, config: Config) => {
  const def = SERVICES[name]
  const group = program.command(name).description(`Manage the optional ${def.label}.`)

  const startCmd = group.command("start").description(`Start the ${def.label} in the background.`)
  if (name === "dashboard") startCmd.option("--no-api", "Don't start the API first")
  startCmd.action((options) => startWithDependencies(name, config, options))

  group
    .command("stop")
    .description(`Stop the ${def.label}.`)
    .action(() => stop(name, config))

  group
    .command("restart")
    .description(`Restart the ${def.label}.`)
    .action(async () => {
      await stop(name, config)
      await startWithDependencies(name, config)
    })

  group
    .command("status")
    .description(`Show whether the ${def.label} is running. Exits 1 when it is not.`)
    .option("--json", "Output JSON")
    .action(async (options) => {
      const status = await getStatus(name, config)
      if (options.json) printJson(status)
      else printStatuses([status])
      if (status.state !== "running") process.exitCode = 1
    })

  group
    .command("logs")
    .description(`Show the ${def.label}'s log.`)
    .option("-n, --lines <count>", "Number of lines", "50")
    .option("-f, --follow", "Keep printing new lines")
    .action(async (options) => {
      const file = logFile(name)
      if (!fs.existsSync(file)) return console.log(`No ${def.label} log yet (${file}).`)
      tailFile(file, Number(options.lines) || 50).forEach((line) => console.log(line))
      if (options.follow) await follow(file, fs.statSync(file).size)
    })
}

export const servicesCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    SERVICE_ORDER.forEach((name) => registerServiceGroup(program, name, config))

    program
      .command("status")
      .description("Show whether the API and dashboard are running.")
      .option("--json", "Output JSON")
      .action(async (options) => {
        const statuses = await getAllStatuses(config)
        if (options.json) return printJson(statuses)
        printStatuses(statuses)
        for (const line of versionWarnings(statuses)) console.log(line)
      })

    program
      .command("start")
      .description("Start the API and the dashboard (whichever are installed).")
      .action(async () => {
        await start("api", config)
        const dashboard = await getStatus("dashboard", config)
        if (dashboard.installed || dashboard.state === "running") await start("dashboard", config)
        else
          console.log(
            "Dashboard not installed; skipping. Install: npm install -g @starktech/velo-dashboard",
          )
      })

    program
      .command("stop")
      .description("Stop the dashboard, then the API.")
      .action(async () => {
        for (const name of [...SERVICE_ORDER].reverse()) await stop(name, config)
      })

    program
      .command("open")
      .description("Open the dashboard in your browser, starting it (and the API) if needed.")
      .action(async () => {
        await startWithDependencies("dashboard", config)
        const url = SERVICES.dashboard.url(config)
        console.log(`Opening ${url}`)
        browser.open(url)
      })
  },
}
