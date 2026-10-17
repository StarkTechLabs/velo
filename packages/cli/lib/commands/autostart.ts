import * as path from "node:path"

import { Config, getConfigPath } from "@starktech/core"
import { Command } from "commander"

import { AutostartManager, buildSpec, isDefaultHome } from "@/autostart/manager"
import { printJson, renderTable } from "@/format"
import { SERVICES, SERVICE_ORDER, ServiceName } from "@/services/definitions"
import { getStatus, serviceDeps, stopService, waitUntilRunning } from "@/services/manage"
import { probe } from "@/services/probe"
import { CommandRegistration } from "@/types"

type Which = ServiceName | "all"

const parseWhich = (value: string | undefined, program: Command): Which => {
  const which = value ?? "all"
  if (which !== "all" && !SERVICE_ORDER.includes(which as ServiceName)) {
    program.error(`Unknown service "${which}". Use api, dashboard or all.`)
  }
  return which as Which
}

const requireManager = (): AutostartManager => {
  const manager = serviceDeps.autostart()
  if (!manager) {
    throw new Error(
      `Autostart is supported on macOS and Linux (this is ${process.platform}). ` +
        "Use `velo start` to start the services by hand.",
    )
  }
  return manager
}

const installOne = async (
  manager: AutostartManager,
  name: ServiceName,
  config: Config,
  dryRun: boolean,
) => {
  const def = SERVICES[name]
  const spec = buildSpec(name, config, serviceDeps.resolveBin(def)) // throws if not installed
  const plan = manager.plan(spec)

  if (dryRun) {
    for (const extra of plan.extraFiles) {
      console.log(
        `# ${def.label} launcher (mode ${extra.mode.toString(8)}): ${extra.file}\n${extra.content}`,
      )
    }
    console.log(`# ${def.label}: ${plan.file}\n${plan.content}`)
    console.log(`# then run:\n${plan.commands.map((c) => `#   ${c}`).join("\n")}\n`)
    return
  }

  // Don't leave a hand-started copy fighting the managed one for the port.
  const current = await probe(def, config)
  if (current.state === "foreign") {
    throw new Error(
      `Cannot set up autostart for the ${def.label}: port ${def.port(config)} is held by ` +
        `another program (${current.detail}). Free it or pick another port first ` +
        `(velo configure --${name}-port <port>).`,
    )
  }
  if (current.state === "running" && !manager.isInstalled(name)) {
    console.log(`Stopping the running ${def.label} so ${manager.kind} can take it over...`)
    await stopService(name, config)
  }

  await manager.install(spec)
  const pid = await waitUntilRunning(def, config, serviceDeps.startTimeoutMs)
  console.log(`${def.label} autostart installed (${manager.kind}): ${plan.file}`)
  console.log(
    pid === null
      ? `  It was installed but is not answering yet; check: velo ${name} logs`
      : `  Running at ${def.url(config)} (pid ${pid}); it will start at login.`,
  )
}

const describeAutostart = (s: { installed: boolean; enabled: boolean; stale: boolean }): string => {
  if (!s.installed) return "not installed"
  if (s.stale) return "stale (run: velo service install)"
  return s.enabled ? "enabled" : "installed but not enabled"
}

export const autostartCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    const group = program
      .command("service")
      .description("Start the API and dashboard automatically when you log in.")

    group
      .command("install [which]")
      .description(
        "Set up autostart for the api, the dashboard, or all (default) and start them now.",
      )
      .option("--dry-run", "Print the files and commands without changing anything")
      .action(async (value: string | undefined, options) => {
        const manager = requireManager()
        const which = parseWhich(value, program)
        const targets = which === "all" ? SERVICE_ORDER : [which]

        for (const name of targets) {
          try {
            await installOne(manager, name, config, Boolean(options.dryRun))
          } catch (err) {
            // `all` skips a package that isn't installed; asking for it by name is an error
            const status = await getStatus(name, config)
            if (which === "all" && !status.installed && status.state !== "running") {
              console.log(
                `${SERVICES[name].label} is not installed; skipping. Install: npm install -g ${SERVICES[name].packageName}`,
              )
              continue
            }
            throw err
          }
        }
        if (options.dryRun) return

        if (!isDefaultHome()) {
          console.log(
            `\nNote: VELO_HOME is set (${getConfigPath()}), so these units are named for that ` +
              "data directory and are separate from the ones for ~/.velo.",
          )
        }
        if (manager.kind === "systemd") {
          console.log(
            "\nsystemd starts user services when you log in. To start them at boot instead, " +
              "run once: sudo loginctl enable-linger $USER",
          )
        } else if (
          targets.includes("dashboard") &&
          !manager.isInstalled("api") &&
          SERVICE_ORDER.some((n) => manager.isInstalled(n))
        ) {
          console.log(
            "\nNote: the API isn't set up for autostart; the dashboard will wait for it at login.",
          )
        } else {
          console.log('\nmacOS may show a "Background items added" notification; that is expected.')
        }
      })

    group
      .command("uninstall [which]")
      .description(
        "Remove autostart for the api, the dashboard, or all (default). Also stops them.",
      )
      .action(async (value: string | undefined) => {
        const manager = requireManager()
        const which = parseWhich(value, program)
        const targets = (which === "all" ? [...SERVICE_ORDER].reverse() : [which]) as ServiceName[]
        let removed = 0
        for (const name of targets) {
          if (!manager.isInstalled(name)) continue
          await manager.uninstall(name)
          removed++
          console.log(
            `${SERVICES[name].label} autostart removed (it was stopped too; use \`velo start\` to run it once).`,
          )
        }
        if (removed === 0) console.log("Nothing to remove: autostart isn't installed.")
      })

    group
      .command("status")
      .description("Show whether each service starts at login, and whether it is running now.")
      .option("--json", "Output JSON")
      .action(async (options) => {
        const manager = requireManager()
        const rows = []
        for (const name of SERVICE_ORDER) {
          let script: string | undefined
          try {
            script = serviceDeps.resolveBin(SERVICES[name])
          } catch {
            // package not installed
          }
          const now = await getStatus(name, config)
          const unit = script
            ? await manager.state(buildSpec(name, config, script))
            : { installed: manager.isInstalled(name), enabled: false, stale: false, file: "" }
          rows.push({ name, label: SERVICES[name].label, autostart: unit, now: now.state })
        }
        if (options.json) return printJson(rows)
        console.log(
          renderTable(
            ["SERVICE", "AUTOSTART", "NOW"],
            rows.map((r) => [r.label, describeAutostart(r.autostart), r.now]),
          ),
        )
        console.log(
          `\nManaged by ${manager.kind}. Data directory: ${path.resolve(getConfigPath())}`,
        )
      })
  },
}
