import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { Config, getConfigPath } from "@starktech/core"

import { SERVICES, ServiceName } from "@/services/definitions"

import {
  UnitSpec,
  renderLauncherScript,
  renderLaunchdPlist,
  renderSystemdUnit,
  unitNames,
} from "./render"

export type RunResult = { code: number; stdout: string; stderr: string }
export type Runner = (command: string, args: string[]) => Promise<RunResult>

/** Runs a command and never throws; failures come back as a non-zero `code`. */
export const defaultRunner: Runner = (command, args) =>
  new Promise((resolve) => {
    execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0
      resolve({ code, stdout, stderr: stderr || (error && code === 1 ? error.message : "") })
    })
  })

/** Seams the tests replace so nothing touches the real login items. */
export const autostartDeps = {
  platform: process.platform as NodeJS.Platform,
  homedir: () => os.homedir(),
  uid: () => process.getuid?.() ?? 0,
  run: defaultRunner,
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}

export type UnitState = {
  /** The unit file exists. */
  installed: boolean
  /** launchd: loaded into the login session. systemd: enabled to start at login. */
  enabled: boolean
  /** The file on disk no longer matches what `velo service install` would write now. */
  stale: boolean
  file: string
}

export interface AutostartManager {
  readonly kind: "launchd" | "systemd"
  /** Where the unit file goes, what it contains, and the commands that activate it. */
  plan(spec: UnitSpec): {
    file: string
    content: string
    commands: string[]
    /** Further files the unit needs (the launchd launcher script), written before `file`. */
    extraFiles: { file: string; content: string; mode: number }[]
  }
  isInstalled(service: ServiceName): boolean
  state(spec: UnitSpec): Promise<UnitState>
  /** Writes the unit and activates it (which also starts the service now). */
  install(spec: UnitSpec): Promise<void>
  /** Deactivates the unit (which stops the service) and deletes its file. */
  uninstall(service: ServiceName): Promise<void>
  /** Starts an installed unit's service now. */
  start(service: ServiceName): Promise<void>
}

const fail = (what: string, result: RunResult): Error =>
  new Error(
    `${what} failed (exit ${result.code}): ${(result.stderr || result.stdout).trim() || "no output"}`,
  )

const defaultHome = () => path.join(autostartDeps.homedir(), ".velo")

/** Whether the data directory in use is the usual `~/.velo` (rather than a `VELO_HOME` one). */
export const isDefaultHome = () => path.resolve(getConfigPath()) === path.resolve(defaultHome())

const names = (service: ServiceName) => unitNames(getConfigPath(), defaultHome(), service)

// ---- macOS: launchd LaunchAgents --------------------------------------------------------------

const launchd = (): AutostartManager => {
  const domain = () => `gui/${autostartDeps.uid()}`
  const label = (service: ServiceName) => names(service).launchdLabel
  const file = (service: ServiceName) =>
    path.join(autostartDeps.homedir(), "Library", "LaunchAgents", `${label(service)}.plist`)
  const target = (service: ServiceName) => `${domain()}/${label(service)}`
  const launchctl = (...args: string[]) => autostartDeps.run("launchctl", args)

  const loaded = async (service: ServiceName) =>
    (await launchctl("print", target(service))).code === 0

  // macOS names a login item after the program it runs, and node is signed by the Node.js
  // Foundation. Run a small script named velo-<service> instead (see renderLauncherScript).
  const launcherFile = (service: ServiceName) =>
    path.join(getConfigPath(), "launchers", `velo-${service}`)

  /**
   * `launchctl bootout` returns before the job is actually gone: the label stays registered until
   * its process has exited, and a `bootstrap` in that window fails with exit 5 ("Input/output
   * error"). So wait for it to unload, and still retry `bootstrap` a few times on that error.
   */
  const unload = async (service: ServiceName) => {
    await launchctl("bootout", target(service)) // fine if it wasn't loaded
    for (let i = 0; i < 100 && (await loaded(service)); i++) await autostartDeps.sleep(100)
  }
  const load = async (service: ServiceName) => {
    let result = await launchctl("bootstrap", domain(), file(service))
    for (let i = 0; i < 10 && result.code === 5; i++) {
      await autostartDeps.sleep(200)
      result = await launchctl("bootstrap", domain(), file(service))
    }
    if (result.code !== 0) throw fail("launchctl bootstrap", result)
  }

  return {
    kind: "launchd",
    plan(spec) {
      const f = file(spec.service)
      const launcher = launcherFile(spec.service)
      return {
        file: f,
        content: renderLaunchdPlist(label(spec.service), spec, launcher),
        commands: [
          `launchctl bootout ${target(spec.service)}   # if already loaded`,
          `launchctl bootstrap ${domain()} ${f}`,
        ],
        extraFiles: [{ file: launcher, content: renderLauncherScript(spec), mode: 0o755 }],
      }
    },
    isInstalled: (service) => fs.existsSync(file(service)),
    async state(spec) {
      const { file: f, content, extraFiles } = this.plan(spec)
      const installed = fs.existsSync(f)
      const differs = (file: string, expected: string) =>
        !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== expected
      return {
        installed,
        enabled: installed && (await loaded(spec.service)),
        stale:
          installed && (differs(f, content) || extraFiles.some((x) => differs(x.file, x.content))),
        file: f,
      }
    },
    async install(spec) {
      const { file: f, content, extraFiles } = this.plan(spec)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.mkdirSync(path.dirname(spec.logFile), { recursive: true }) // launchd won't create it
      for (const extra of extraFiles) {
        fs.mkdirSync(path.dirname(extra.file), { recursive: true })
        fs.writeFileSync(extra.file, extra.content, { mode: extra.mode })
        fs.chmodSync(extra.file, extra.mode) // writeFileSync's mode is ignored for existing files
      }
      fs.writeFileSync(f, content)
      await unload(spec.service)
      await load(spec.service)
    },
    async uninstall(service) {
      await unload(service)
      fs.rmSync(file(service), { force: true })
      fs.rmSync(launcherFile(service), { force: true })
      try {
        fs.rmdirSync(path.dirname(launcherFile(service))) // only if nothing else is in it
      } catch {
        // not empty, or already gone
      }
    },
    async start(service) {
      if (!(await loaded(service))) return load(service)
      const result = await launchctl("kickstart", target(service))
      if (result.code !== 0) throw fail("launchctl kickstart", result)
    },
  }
}

// ---- Linux: systemd user units ----------------------------------------------------------------

const systemd = (): AutostartManager => {
  const unit = (service: ServiceName) => names(service).systemdUnit
  const dir = () =>
    path.join(
      process.env.XDG_CONFIG_HOME || path.join(autostartDeps.homedir(), ".config"),
      "systemd",
      "user",
    )
  const file = (service: ServiceName) => path.join(dir(), unit(service))
  const systemctl = (...args: string[]) => autostartDeps.run("systemctl", ["--user", ...args])

  const check = (result: RunResult, what: string) => {
    if (result.code === 0) return
    const text = `${result.stderr}${result.stdout}`
    if (/Failed to connect to (user )?bus|No such file or directory|XDG_RUNTIME_DIR/i.test(text)) {
      throw new Error(
        `${what} failed: there is no systemd user session here (are you logged in through ` +
          `ssh or a container?). Log in with a normal session, or run velo manually.\n${text.trim()}`,
      )
    }
    throw fail(what, result)
  }

  return {
    kind: "systemd",
    plan(spec) {
      const f = file(spec.service)
      const after = spec.after ? unit(spec.after.service) : undefined
      return {
        file: f,
        content: renderSystemdUnit(spec, after),
        extraFiles: [],
        commands: [
          "systemctl --user daemon-reload",
          `systemctl --user enable --now ${unit(spec.service)}`,
        ],
      }
    },
    isInstalled: (service) => fs.existsSync(file(service)),
    async state(spec) {
      const { file: f, content } = this.plan(spec)
      const installed = fs.existsSync(f)
      const enabled = installed && (await systemctl("is-enabled", unit(spec.service))).code === 0
      return {
        installed,
        enabled,
        stale: installed && fs.readFileSync(f, "utf8") !== content,
        file: f,
      }
    },
    async install(spec) {
      const { file: f, content } = this.plan(spec)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.mkdirSync(path.dirname(spec.logFile), { recursive: true }) // systemd won't create it
      fs.writeFileSync(f, content)
      check(await systemctl("daemon-reload"), "systemctl daemon-reload")
      check(await systemctl("enable", "--now", unit(spec.service)), "systemctl enable")
      // enable --now doesn't restart a unit that is already running with an older definition
      check(await systemctl("restart", unit(spec.service)), "systemctl restart")
    },
    async uninstall(service) {
      await systemctl("disable", "--now", unit(service)) // fine if it wasn't enabled
      fs.rmSync(file(service), { force: true })
      await systemctl("daemon-reload")
    },
    async start(service) {
      check(await systemctl("start", unit(service)), "systemctl start")
    },
  }
}

/** The service manager for this OS, or null where autostart isn't supported (Windows). */
export const getManager = (): AutostartManager | null => {
  if (autostartDeps.platform === "darwin") return launchd()
  if (autostartDeps.platform === "linux") return systemd()
  return null
}

/** Builds what the OS should run for a service, from the current config. */
export const buildSpec = (service: ServiceName, config: Config, script: string): UnitSpec => {
  const def = SERVICES[service]
  const home = getConfigPath()
  return {
    service,
    description: `velo ${def.label.toLowerCase()}`,
    execPath: process.execPath,
    script,
    // The API reads its host and port from config.json each time it starts, so it never goes
    // stale. The dashboard doesn't read config, so its ports are baked in (see `service status`).
    args: service === "api" ? [] : [...def.args(config), "--wait-for-api", "60"],
    env: isDefaultHome() ? {} : { VELO_HOME: home },
    logFile: path.join(home, "run", `${service}.log`),
    after: service === "dashboard" ? { service: "api" } : undefined,
  }
}
