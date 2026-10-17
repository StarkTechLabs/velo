import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { Runner, autostartDeps } from "@/autostart/manager"

export type Call = { command: string; args: string[] }

const original = { ...autostartDeps }

/**
 * Points the autostart code at a temp "home" and a fake `launchctl`/`systemctl`, so tests can
 * install and remove units without touching the real login items. `respond` decides each
 * command's result (default: success).
 */
export const useFakeAutostart = (
  platform: NodeJS.Platform,
  initial: (call: Call) => Partial<{ code: number; stdout: string; stderr: string }> = () => ({}),
) => {
  const state = { home: "", calls: [] as Call[], respond: initial }

  beforeEach(() => {
    state.home = fs.mkdtempSync(path.join(os.tmpdir(), "velo-autostart-"))
    state.calls = []
    state.respond = initial // tests may override it
    const run: Runner = async (command, args) => {
      const call = { command, args }
      state.calls.push(call)
      return { code: 0, stdout: "", stderr: "", ...state.respond(call) }
    }
    Object.assign(autostartDeps, {
      platform,
      homedir: () => state.home,
      uid: () => 501,
      run,
    })
    process.env.XDG_CONFIG_HOME = path.join(state.home, ".config")
  })

  afterEach(() => {
    Object.assign(autostartDeps, original)
    process.env.XDG_CONFIG_HOME = path.join(
      path.dirname(process.env.VELO_TEST_SAFE_HOME!),
      ".config",
    )
    fs.rmSync(state.home, { recursive: true, force: true })
  })

  const summary = () => state.calls.map((c) => `${c.command} ${c.args.join(" ")}`)
  return Object.assign(state, { summary })
}

// ---- a fake launchctl / systemctl that really starts what the unit files say ------------------

type Child = { argv: string[]; env: NodeJS.ProcessEnv; pid?: number }
type Fake = ReturnType<typeof makeFakeManager>

const unescapeXml = (v: string) =>
  v
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")

/** Command line and environment out of a launchd plist. */
export const parsePlist = (content: string): { argv: string[]; env: Record<string, string> } => {
  const block = (key: string) =>
    content.split(`<key>${key}</key>`)[1]?.split(/<\/array>|<\/dict>/)[0] ?? ""
  const argv = [...block("ProgramArguments").matchAll(/<string>(.*?)<\/string>/g)].map((m) =>
    unescapeXml(m[1]),
  )
  const env = Object.fromEntries(
    [...block("EnvironmentVariables").matchAll(/<key>(.*?)<\/key>\s*<string>(.*?)<\/string>/g)].map(
      (m) => [unescapeXml(m[1]), unescapeXml(m[2])],
    ),
  )
  return { argv, env }
}

/** Command line and environment out of a systemd unit. */
export const parseUnit = (content: string): { argv: string[]; env: Record<string, string> } => {
  const tokens = (line: string) =>
    [...line.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) =>
      (m[1] ?? m[2]).replace(/\\(.)/g, "$1").replace(/%%/g, "%").replace(/\$\$/g, "$"),
    )
  const argv = tokens(/^ExecStart=(.*)$/m.exec(content)?.[1] ?? "")
  const env = Object.fromEntries(
    [...content.matchAll(/^Environment=(.*)$/gm)].map((m) => {
      const [assignment] = tokens(m[1])
      const eq = assignment.indexOf("=")
      return [assignment.slice(0, eq), assignment.slice(eq + 1)]
    }),
  )
  return { argv, env }
}

const makeFakeManager = (kind: "launchd" | "systemd") => {
  const units = new Map<string, Child>() // unit name -> how to start it
  const enabled = new Set<string>()
  const running = new Map<string, number>() // unit name -> pid

  const launch = (unit: string) => {
    const child = units.get(unit)!
    const proc = spawn(child.argv[0], child.argv.slice(1), {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, ...child.env },
    })
    proc.unref()
    running.set(unit, proc.pid!)
  }
  // like the real managers, notice a service that exited on its own (e.g. `velo api stop`)
  const alive = (unit: string) => {
    const pid = running.get(unit)
    if (!pid) return false
    try {
      process.kill(pid, 0)
      return true
    } catch {
      running.delete(unit)
      return false
    }
  }
  const halt = (unit: string) => {
    const pid = running.get(unit)
    if (pid) {
      try {
        process.kill(pid, "SIGTERM")
      } catch {
        // already gone
      }
    }
    running.delete(unit)
  }

  const unitName = (target: string) => target.split("/").pop()!
  const load = (file: string) => {
    const content = fs.readFileSync(file, "utf8")
    const parsed = kind === "launchd" ? parsePlist(content) : parseUnit(content)
    const name = path.basename(file).replace(/\.plist$/, "")
    units.set(name, { argv: parsed.argv, env: parsed.env })
    return name
  }

  const respond = ({ command, args }: Call) => {
    if (kind === "launchd" && command === "launchctl") {
      const [verb, a, b] = args
      if (verb === "bootstrap") {
        const unit = load(b)
        launch(unit)
        enabled.add(unit)
      } else if (verb === "bootout") {
        const unit = unitName(a)
        if (!enabled.has(unit)) return { code: 113 }
        halt(unit)
        enabled.delete(unit)
      } else if (verb === "print") return enabled.has(unitName(a)) ? {} : { code: 113 }
      else if (verb === "kickstart") {
        const unit = unitName(a)
        if (!alive(unit)) launch(unit)
      }
    } else if (kind === "systemd" && command === "systemctl") {
      const [, verb, ...rest] = args // args[0] is --user
      const unit = rest.filter((r) => !r.startsWith("--")).at(-1)!
      const dir = path.join(process.env.XDG_CONFIG_HOME!, "systemd", "user")
      if (verb === "enable") {
        load(path.join(dir, unit))
        enabled.add(unit)
        launch(unit)
      } else if (verb === "restart") {
        halt(unit)
        load(path.join(dir, unit))
        launch(unit)
      } else if (verb === "start") {
        if (!alive(unit)) launch(unit)
      } else if (verb === "disable") {
        halt(unit)
        enabled.delete(unit)
      } else if (verb === "is-enabled") return enabled.has(unit) ? {} : { code: 1 }
    }
    return {}
  }

  const stopAll = () => [...running.keys()].forEach(halt)
  return { respond, stopAll, running, enabled, units }
}

/**
 * useFakeAutostart plus a fake service manager behind it: enabling or bootstrapping a unit
 * starts exactly the command line (and environment) its file specifies, and disabling stops it.
 */
export const useFakeServiceManager = (kind: "launchd" | "systemd") => {
  let fake: Fake
  const base = useFakeAutostart(kind === "launchd" ? "darwin" : "linux", (call) =>
    fake.respond(call),
  )
  beforeEach(() => {
    fake = makeFakeManager(kind)
  })
  afterEach(() => fake.stopAll())
  return Object.assign(base, {
    get manager() {
      return fake
    },
  })
}
