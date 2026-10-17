import * as fs from "node:fs"
import * as path from "node:path"

import { configSchema } from "@starktech/core"

import { readPid } from "@/services/files"
import { serviceDeps, startService } from "@/services/manage"
import { NotInstalledError } from "@/services/resolve"
import { autostartDeps } from "@/autostart/manager"
import { useFakeServiceManager } from "@/testing/autostart"
import { FAKE_SERVICE, useFakeServices } from "@/testing/fakeServices"
import { runCli } from "@/testing/run"

jest.setTimeout(20_000) // these start real processes

const fake = useFakeServices()
const launchd = useFakeServiceManager("launchd")
const cli = (...args: string[]) => runCli(args, fake.config)

// useFakeServices disables the service manager; these tests want the real manager code
beforeEach(() => {
  serviceDeps.autostart = original.autostart
})
const original = { autostart: serviceDeps.autostart }

const agentsDir = () => path.join(launchd.home, "Library", "LaunchAgents")
const plists = () => (fs.existsSync(agentsDir()) ? fs.readdirSync(agentsDir()).sort() : [])
const health = async (port: number, path: string) => {
  try {
    return await (await fetch(`http://127.0.0.1:${port}${path}`)).json()
  } catch {
    return null
  }
}
const apiHealth = () => health(fake.config.api.port, "/api/health")
const dashboardConfig = () => health(fake.config.dashboard.port, "/config.json")

describe("service install (launchd)", () => {
  it("writes an agent per service and starts exactly what the plist says", async () => {
    const { out, failure } = await cli("service", "install")
    expect(failure).toBeUndefined()

    expect(plists()).toHaveLength(2)
    expect(plists()[0]).toMatch(/^dev\.starktech\.velo\.[0-9a-f]{8}\.api\.plist$/)
    expect(plists()[1]).toMatch(/^dev\.starktech\.velo\.[0-9a-f]{8}\.dashboard\.plist$/)
    expect(out).toContain("API autostart installed (launchd)")
    expect(out).toContain("Dashboard autostart installed (launchd)")
    expect(out).toContain("it will start at login")
    expect(out).toContain("separate from the ones for ~/.velo") // sandbox data directory

    // macOS names a login item after the program it runs, so each agent runs a launcher
    // called velo-api / velo-dashboard (not the Foundation-signed node binary)
    const launchers = path.join(process.env.VELO_HOME as string, "launchers")
    expect(fs.readdirSync(launchers).sort()).toEqual(["velo-api", "velo-dashboard"])
    const apiPlist = fs.readFileSync(path.join(agentsDir(), plists()[0]), "utf8")
    expect(apiPlist).toContain(`<string>${path.join(launchers, "velo-api")}</string>`)
    expect(apiPlist).not.toContain(process.execPath)

    // what actually ran came from the plist: right ports, home, and the wait-for-api option
    const dashboard = await dashboardConfig()
    expect(dashboard.args).toEqual([
      "--port",
      String(fake.config.dashboard.port),
      "--api-url",
      `http://127.0.0.1:${fake.config.api.port}`,
      "--home",
      process.env.VELO_HOME,
      "--wait-for-api",
      "60",
    ])
    expect((await apiHealth()).home).toBe(process.env.VELO_HOME) // passed through EnvironmentVariables
  })

  it("is repeatable: installing again replaces the running service", async () => {
    await cli("service", "install", "api")
    const first = (await apiHealth()).pid
    const again = await cli("service", "install", "api")
    expect(again.failure).toBeUndefined()
    const second = (await apiHealth()).pid
    expect(second).not.toBe(first)
    expect(plists()).toHaveLength(1)
  })

  it("takes over a service that was started by hand, without leaving two copies", async () => {
    const manual = await startService("api", fake.config)
    const { out } = await cli("service", "install", "api")
    expect(out).toContain("Stopping the running API so launchd can take it over")
    const now = (await apiHealth()).pid
    expect(now).not.toBe(manual.pid)
    expect(() => process.kill(manual.pid, 0)).toThrow() // the hand-started copy is gone
  })

  it("refuses when something else holds the port, and writes nothing", async () => {
    const http = await import("node:http")
    const server = http
      .createServer((_q, r) => r.end("hi"))
      .listen(fake.config.api.port, "127.0.0.1")
    await new Promise((r) => server.once("listening", r))
    try {
      const { failure } = await cli("service", "install", "api")
      expect(failure?.message).toContain("held by another program")
      expect(plists()).toEqual([])
    } finally {
      server.close()
    }
  })

  it("--dry-run prints the plist and commands and changes nothing", async () => {
    const { out } = await cli("service", "install", "--dry-run")
    expect(out).toContain("API launcher (mode 755)")
    expect(out).toContain("exec ")
    expect(out).toContain("<key>RunAtLoad</key>")
    expect(out).toContain("launchctl bootstrap gui/501")
    expect(out).toContain("--wait-for-api")
    expect(plists()).toEqual([])
    expect(launchd.calls).toEqual([])
    expect(await apiHealth()).toBeNull()
  })

  it("skips a dashboard that isn't installed for `all`, but errors if asked for by name", async () => {
    serviceDeps.resolveBin = (def) => {
      if (def.name === "dashboard") throw new NotInstalledError(def)
      return FAKE_SERVICE
    }
    const all = await cli("service", "install")
    expect(all.failure).toBeUndefined()
    expect(all.out).toContain("Dashboard is not installed; skipping")
    expect(plists()).toHaveLength(1)

    const named = await cli("service", "install", "dashboard")
    expect(named.failure?.message).toContain("npm install -g @starktech/velo-dashboard")
  })

  it("rejects an unknown service name", async () => {
    const { failure } = await cli("service", "install", "everything")
    expect(failure?.message).toContain('Unknown service "everything"')
  })
})

describe("service status", () => {
  it("shows not installed, then enabled and running, then stale when the config moves on", async () => {
    expect((await cli("service", "status")).out).toMatch(/API\s+not installed\s+stopped/)

    await cli("service", "install")
    const { out } = await cli("service", "status")
    expect(out).toMatch(/API\s+enabled\s+running/)
    expect(out).toMatch(/Dashboard\s+enabled\s+running/)
    expect(out).toContain("Managed by launchd")

    // the dashboard's port is baked into its unit, so a config change makes it stale
    const moved = configSchema.parse({
      api: { port: fake.config.api.port },
      dashboard: { port: fake.config.dashboard.port + 1 },
    })
    const stale = await runCli(["service", "status"], moved)
    expect(stale.out).toMatch(/Dashboard\s+stale \(run: velo service install\)/)
    expect(stale.out).toMatch(/API\s+enabled/) // the API follows config.json, so it never goes stale
  })

  it("--json is machine readable", async () => {
    await cli("service", "install", "api")
    const rows = JSON.parse((await cli("service", "status", "--json")).out)
    expect(rows[0]).toMatchObject({
      name: "api",
      now: "running",
      autostart: { installed: true, enabled: true },
    })
    expect(rows[1]).toMatchObject({ name: "dashboard", autostart: { installed: false } })
  })
})

describe("service uninstall", () => {
  it("removes the agents and stops the services, dashboard first", async () => {
    await cli("service", "install")
    const { out } = await cli("service", "uninstall")
    expect(out.split("\n")[0]).toContain("Dashboard autostart removed")
    expect(out.split("\n")[1]).toContain("API autostart removed")
    expect(plists()).toEqual([])
    await new Promise((r) => setTimeout(r, 300))
    expect(await apiHealth()).toBeNull()
    expect(await dashboardConfig()).toBeNull()
  })

  it("can remove one service, and says so when there is nothing to remove", async () => {
    await cli("service", "install")
    await cli("service", "uninstall", "dashboard")
    expect(plists()).toHaveLength(1)
    await cli("service", "uninstall")
    expect((await cli("service", "uninstall")).out).toBe(
      "Nothing to remove: autostart isn't installed.",
    )
  })

  it("only touches this data directory's units, never another's", async () => {
    await cli("service", "install", "api")
    const mine = plists()
    // a unit that belongs to the default data directory (what a real install would have made)
    fs.writeFileSync(path.join(agentsDir(), "dev.starktech.velo.api.plist"), "<real/>")
    await cli("service", "uninstall")
    expect(plists()).toEqual(["dev.starktech.velo.api.plist"])
    expect(mine).not.toContain("dev.starktech.velo.api.plist")
    expect(fs.readFileSync(path.join(agentsDir(), "dev.starktech.velo.api.plist"), "utf8")).toBe(
      "<real/>",
    )
  })
})

describe("start and configure once autostart exists", () => {
  it("`velo api start` asks launchd instead of spawning a second copy", async () => {
    await cli("service", "install", "api")
    await cli("api", "stop") // SIGTERM exits 0, so launchd's KeepAlive{SuccessfulExit:false} leaves it down
    await new Promise((r) => setTimeout(r, 300))
    expect(await apiHealth()).toBeNull()

    launchd.calls.length = 0
    const { out, failure } = await cli("api", "start")
    expect(failure?.message).toBeUndefined()
    expect(out).toMatch(/API started at http:\/\/127\.0\.0\.1:\d+ \(pid \d+, by launchd\)/)
    expect(launchd.summary().map((c) => c.split(" ")[1])).toContain("kickstart")
    expect(readPid("api")).toBeNull() // we didn't spawn anything ourselves
    expect(await apiHealth()).not.toBeNull()
  })

  it("`velo configure` tells you to refresh the units", async () => {
    await cli("service", "install", "api")
    const { out } = await cli("configure", "--dashboard-port", "4999")
    expect(out).toContain("run `velo service install`")
  })
})

describe("unsupported platforms", () => {
  it("explains and points at `velo start`", async () => {
    autostartDeps.platform = "win32"
    for (const sub of ["install", "uninstall", "status"]) {
      const { failure } = await cli("service", sub)
      expect(failure?.message).toContain("Autostart is supported on macOS and Linux")
      expect(failure?.message).toContain("velo start")
    }
  })
})
