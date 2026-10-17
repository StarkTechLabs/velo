import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { configSchema } from "@starktech/core"

import { useFakeAutostart } from "@/testing/autostart"

import { autostartDeps, buildSpec, getManager } from "./manager"

const config = configSchema.parse({ api: { port: 4317 }, dashboard: { port: 4318 } })
const script = (name: string) => `/pkgs/${name}/dist/main.js`

describe("getManager", () => {
  const darwin = useFakeAutostart("darwin")
  it("picks launchd on macOS", () => expect(getManager()?.kind).toBe("launchd"))
  it("keeps the fake home in play", () => expect(darwin.home).toContain("velo-autostart-"))
})

describe("getManager on other platforms", () => {
  useFakeAutostart("linux")
  it("picks systemd on Linux", () => expect(getManager()?.kind).toBe("systemd"))
})

describe("getManager on unsupported platforms", () => {
  useFakeAutostart("win32")
  it("returns null", () => expect(getManager()).toBeNull())
})

describe("buildSpec", () => {
  const fake = useFakeAutostart("darwin")

  it("lets the API follow config.json, but bakes the dashboard's ports in", () => {
    const api = buildSpec("api", config, script("api"))
    expect(api.args).toEqual([])
    const dashboard = buildSpec("dashboard", config, script("dashboard"))
    expect(dashboard.args).toEqual(
      expect.arrayContaining([
        "--port",
        "4318",
        "--api-url",
        "http://127.0.0.1:4317",
        "--wait-for-api",
        "60",
      ]),
    )
    expect(dashboard.after).toEqual({ service: "api" })
    expect(api.execPath).toBe(process.execPath)
  })

  it("only sets VELO_HOME for a non-default data directory", () => {
    const saved = process.env.VELO_HOME
    process.env.VELO_HOME = "/somewhere/else/.velo"
    expect(buildSpec("api", config, script("api")).env).toEqual({
      VELO_HOME: "/somewhere/else/.velo",
    })
    process.env.VELO_HOME = path.join(fake.home, ".velo") // i.e. the default data directory
    expect(buildSpec("api", config, script("api")).env).toEqual({})
    process.env.VELO_HOME = saved
  })
})

describe("launchd manager", () => {
  const fake = useFakeAutostart(
    "darwin",
    ({ args }) => (args[0] === "print" ? { code: 113 } : {}), // not loaded until installed
  )
  const spec = () => buildSpec("api", config, script("api"))
  const plist = () =>
    path.join(fake.home, "Library", "LaunchAgents", "dev.starktech.velo.sandbox.api.plist")

  // these tests run with a non-default VELO_HOME (see jest env), so labels carry a tag
  const labelPrefix = "dev.starktech.velo."

  beforeEach(() => {
    process.env.VELO_HOME = path.join(fake.home, "velo-data")
  })
  afterEach(() => (process.env.VELO_HOME = process.env.VELO_TEST_SAFE_HOME))

  it("writes the plist, then bootout and bootstrap in the login session", async () => {
    const manager = getManager()!
    await manager.install(spec())

    const file = fs
      .readdirSync(path.join(fake.home, "Library", "LaunchAgents"))
      .find((f) => f.startsWith(labelPrefix))!
    expect(file).toMatch(/^dev\.starktech\.velo\.[0-9a-f]{8}\.api\.plist$/)
    const full = path.join(fake.home, "Library", "LaunchAgents", file)
    expect(fs.readFileSync(full, "utf8")).toContain("<key>RunAtLoad</key>")
    const label = file.replace(/\.plist$/, "")
    expect(fake.summary()).toEqual([
      `launchctl bootout gui/501/${label}`,
      `launchctl print gui/501/${label}`, // has it finished unloading?
      `launchctl bootstrap gui/501 ${full}`,
    ])
    expect(plist).toBeDefined()
  })

  describe("launcher script (so the login item is named velo-api, not Node.js Foundation)", () => {
    const launcher = () => path.join(process.env.VELO_HOME!, "launchers", "velo-api")
    const plistFile = () => {
      const dir = path.join(fake.home, "Library", "LaunchAgents")
      return path.join(
        dir,
        fs.readdirSync(dir).find((f) => f.endsWith(".api.plist"))!,
      )
    }

    it("is written executable, and the agent runs it instead of node", async () => {
      await getManager()!.install(spec())
      expect(fs.statSync(launcher()).mode & 0o777).toBe(0o755)
      const content = fs.readFileSync(launcher(), "utf8")
      expect(content).toContain(`exec '${process.execPath}' '/pkgs/api/dist/main.js'`)
      const plist = fs.readFileSync(plistFile(), "utf8")
      expect(plist).toContain(`<string>${launcher()}</string>`)
      expect(plist).not.toContain(process.execPath)
    })

    it("is part of the plan, so --dry-run can show it", () => {
      const plan = getManager()!.plan(spec())
      expect(plan.extraFiles).toEqual([expect.objectContaining({ file: launcher(), mode: 0o755 })])
    })

    it("makes the unit stale when it is edited or goes missing", async () => {
      const manager = getManager()!
      await manager.install(spec())
      fake.respond = () => ({})
      expect((await manager.state(spec())).stale).toBe(false)

      fs.writeFileSync(launcher(), "#!/bin/sh\nexec something-else\n")
      expect((await manager.state(spec())).stale).toBe(true)

      await manager.install(spec()) // repaired by reinstalling
      expect((await manager.state(spec())).stale).toBe(false)

      fs.rmSync(launcher())
      expect((await manager.state(spec())).stale).toBe(true)
    })

    it("is removed by uninstall, along with its folder when empty", async () => {
      const manager = getManager()!
      await manager.install(spec())
      await manager.uninstall("api")
      expect(fs.existsSync(launcher())).toBe(false)
      expect(fs.existsSync(path.dirname(launcher()))).toBe(false)
    })

    it("leaves other files in the launchers folder alone", async () => {
      const manager = getManager()!
      await manager.install(spec())
      fs.writeFileSync(path.join(path.dirname(launcher()), "keep-me"), "x")
      await manager.uninstall("api")
      expect(fs.existsSync(path.join(path.dirname(launcher()), "keep-me"))).toBe(true)
    })
  })

  it("creates the log directory, which launchd will not", async () => {
    const logDir = path.join(process.env.VELO_HOME!, "run")
    expect(fs.existsSync(logDir)).toBe(false)
    await getManager()!.install(spec())
    expect(fs.existsSync(logDir)).toBe(true)
  })

  it("waits for a bootout to finish before bootstrapping (launchd unloads asynchronously)", async () => {
    // real launchd: after `bootout` the job stays registered until its process has exited, and
    // `bootstrap` of that label meanwhile fails with exit 5 (Input/output error)
    let lingering = 0
    fake.respond = ({ args }) => {
      if (args[0] === "bootout") {
        lingering = 3
        return {}
      }
      if (args[0] === "print") return lingering > 0 ? (lingering--, {}) : { code: 113 }
      if (args[0] === "bootstrap" && lingering > 0) {
        return { code: 5, stderr: "Bootstrap failed: 5: Input/output error" }
      }
      return {}
    }
    await getManager()!.install(spec())
    const verbs = fake.summary().map((c) => c.split(" ")[1])
    expect(verbs[0]).toBe("bootout")
    expect(verbs.at(-1)).toBe("bootstrap")
    expect(verbs.filter((v) => v === "bootstrap")).toHaveLength(1) // not attempted until it was gone
  })

  it("retries a bootstrap that still hits the unload race, then gives up with the real error", async () => {
    let attempts = 0
    fake.respond = ({ args }) => {
      if (args[0] === "print") return { code: 113 }
      if (args[0] === "bootstrap") {
        attempts++
        return attempts < 3 ? { code: 5, stderr: "Input/output error" } : {}
      }
      return {}
    }
    await getManager()!.install(spec())
    expect(attempts).toBe(3)

    attempts = -100 // never succeeds
    await expect(getManager()!.install(spec())).rejects.toThrow(
      "launchctl bootstrap failed (exit 5)",
    )
  })

  it("reports a failed bootstrap with launchctl's message", async () => {
    fake.respond = ({ args }) =>
      args[0] === "bootstrap" ? { code: 5, stderr: "Bootstrap failed: 5: Input/output error" } : {}
    await expect(getManager()!.install(spec())).rejects.toThrow(
      "launchctl bootstrap failed (exit 5): Bootstrap failed: 5: Input/output error",
    )
  })

  it("reports installed / loaded / stale", async () => {
    const manager = getManager()!
    expect(await manager.state(spec())).toMatchObject({
      installed: false,
      enabled: false,
      stale: false,
    })

    await manager.install(spec())
    fake.respond = () => ({}) // print succeeds: loaded
    expect(await manager.state(spec())).toMatchObject({
      installed: true,
      enabled: true,
      stale: false,
    })

    // the config changed since: a different dashboard port makes the baked unit stale
    const changed = buildSpec(
      "dashboard",
      configSchema.parse({ dashboard: { port: 4999 } }),
      script("d"),
    )
    await manager.install(buildSpec("dashboard", config, script("d")))
    expect((await manager.state(changed)).stale).toBe(true)
  })

  it("uninstall boots the agent out and deletes the file", async () => {
    const manager = getManager()!
    await manager.install(spec())
    fake.calls.length = 0
    await manager.uninstall("api")
    expect(fake.summary()[0]).toMatch(
      /^launchctl bootout gui\/501\/dev\.starktech\.velo\.[0-9a-f]{8}\.api$/,
    )
    expect(manager.isInstalled("api")).toBe(false)
  })

  it("start kickstarts a loaded agent, or bootstraps one that isn't loaded", async () => {
    const manager = getManager()!
    await manager.install(spec())
    fake.calls.length = 0

    fake.respond = () => ({}) // loaded
    await manager.start("api")
    expect(fake.summary().map((s) => s.split(" ")[1])).toEqual(["print", "kickstart"])

    fake.calls.length = 0
    fake.respond = ({ args }) => (args[0] === "print" ? { code: 113 } : {})
    await manager.start("api")
    expect(fake.summary().map((s) => s.split(" ")[1])).toEqual(["print", "bootstrap"])
  })

  it("uses the plain label for the default data directory", async () => {
    process.env.VELO_HOME = path.join(fake.home, ".velo") // the default data directory
    const manager = getManager()!
    await manager.install(spec())
    expect(
      fs.existsSync(
        path.join(fake.home, "Library", "LaunchAgents", "dev.starktech.velo.api.plist"),
      ),
    ).toBe(true)
  })
})

describe("systemd manager", () => {
  const fake = useFakeAutostart("linux")
  const spec = (service: "api" | "dashboard" = "api") => buildSpec(service, config, script(service))

  beforeEach(() => {
    process.env.VELO_HOME = path.join(fake.home, "velo-data")
  })
  afterEach(() => (process.env.VELO_HOME = process.env.VELO_TEST_SAFE_HOME))

  const unitDir = () => path.join(fake.home, ".config", "systemd", "user")

  it("writes the unit, reloads, enables it now, and restarts to pick up changes", async () => {
    await getManager()!.install(spec())
    const files = fs.readdirSync(unitDir())
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^velo-[0-9a-f]{8}-api\.service$/)
    expect(fake.summary()).toEqual([
      "systemctl --user daemon-reload",
      `systemctl --user enable --now ${files[0]}`,
      `systemctl --user restart ${files[0]}`,
    ])
  })

  it("creates the log directory, which systemd will not", async () => {
    const logDir = path.join(process.env.VELO_HOME!, "run")
    expect(fs.existsSync(logDir)).toBe(false)
    await getManager()!.install(spec())
    expect(fs.existsSync(logDir)).toBe(true)
  })

  it("orders the dashboard unit after the API unit", async () => {
    await getManager()!.install(spec("dashboard"))
    const [file] = fs.readdirSync(unitDir())
    const content = fs.readFileSync(path.join(unitDir(), file), "utf8")
    expect(content).toMatch(
      /After=velo-[0-9a-f]{8}-api\.service\nWants=velo-[0-9a-f]{8}-api\.service/,
    )
    expect(content).toContain("--wait-for-api 60")
  })

  it("explains a missing user session instead of a bare exit code", async () => {
    fake.respond = () => ({ code: 1, stderr: "Failed to connect to bus: No medium found" })
    await expect(getManager()!.install(spec())).rejects.toThrow("no systemd user session")
  })

  it("reports other failures with the command's output", async () => {
    fake.respond = ({ args }) =>
      args.includes("enable") ? { code: 1, stderr: "Unit is masked" } : {}
    await expect(getManager()!.install(spec())).rejects.toThrow(
      "systemctl enable failed (exit 1): Unit is masked",
    )
  })

  it("reports enabled state, and stale units", async () => {
    const manager = getManager()!
    expect(await manager.state(spec())).toMatchObject({ installed: false, enabled: false })
    await manager.install(spec())
    expect(await manager.state(spec())).toMatchObject({
      installed: true,
      enabled: true,
      stale: false,
    })
    fake.respond = ({ args }) => (args[1] === "is-enabled" ? { code: 1 } : {})
    expect((await manager.state(spec())).enabled).toBe(false)
    expect((await manager.state(buildSpec("api", config, "/moved/main.js"))).stale).toBe(true)
  })

  it("uninstall disables the unit, deletes it, and reloads", async () => {
    const manager = getManager()!
    await manager.install(spec())
    fake.calls.length = 0
    await manager.uninstall("api")
    expect(fake.summary().map((s) => s.replace(/velo-[0-9a-f]{8}-api\.service/, "UNIT"))).toEqual([
      "systemctl --user disable --now UNIT",
      "systemctl --user daemon-reload",
    ])
    expect(fs.readdirSync(unitDir())).toEqual([])
  })

  it("start runs systemctl start", async () => {
    await getManager()!.install(spec())
    fake.calls.length = 0
    await getManager()!.start("api")
    expect(fake.summary()[0]).toMatch(/^systemctl --user start velo-[0-9a-f]{8}-api\.service$/)
  })

  it("honours XDG_CONFIG_HOME", async () => {
    process.env.XDG_CONFIG_HOME = path.join(fake.home, "xdg")
    await getManager()!.install(spec())
    expect(fs.readdirSync(path.join(fake.home, "xdg", "systemd", "user"))).toHaveLength(1)
  })
})

describe("test isolation (see lib/testing/setup.ts)", () => {
  it("makes the real launchctl/systemctl and the real home unreachable by default", async () => {
    await expect(autostartDeps.run("launchctl", ["list"])).rejects.toThrow(
      "tried to run `launchctl list` on the real system",
    )
    expect(autostartDeps.homedir()).toContain("velo-jest-")
    expect(autostartDeps.homedir()).not.toBe(os.homedir())
    expect(process.env.VELO_HOME).toContain("velo-jest-")
    expect(process.env.XDG_CONFIG_HOME).toContain("velo-jest-")
  })
})
