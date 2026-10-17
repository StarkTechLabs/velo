import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import {
  UnitSpec,
  renderLauncherScript,
  renderLaunchdPlist,
  renderSystemdUnit,
  systemdQuote,
  unitNames,
} from "./render"

const spec: UnitSpec = {
  service: "dashboard",
  description: "velo dashboard",
  execPath: "/opt/node 22/bin/node",
  script: "/usr/lib/node_modules/@starktech/velo-dashboard/dist/main.js",
  args: ["--port", "4318", "--api-url", "http://127.0.0.1:4317"],
  env: { VELO_HOME: "/data/a&b" },
  logFile: "/home/me/.velo/run/dashboard.log",
}

describe("unitNames", () => {
  it("uses plain names for the default data directory", () => {
    expect(unitNames("/home/me/.velo", "/home/me/.velo", "api")).toEqual({
      isDefault: true,
      launchdLabel: "dev.starktech.velo.api",
      systemdUnit: "velo-api.service",
    })
  })

  it("adds a stable per-directory tag for any other directory, so it can't touch the real units", () => {
    const sandbox = unitNames("/work/velo/.velo-dev", "/home/me/.velo", "api")
    expect(sandbox.isDefault).toBe(false)
    expect(sandbox.launchdLabel).toMatch(/^dev\.starktech\.velo\.[0-9a-f]{8}\.api$/)
    expect(sandbox.systemdUnit).toMatch(/^velo-[0-9a-f]{8}-api\.service$/)
    expect(sandbox).toEqual(unitNames("/work/velo/.velo-dev/", "/home/me/.velo", "api")) // trailing slash
    expect(sandbox.launchdLabel).not.toBe(
      unitNames("/home/me/.velo", "/home/me/.velo", "api").launchdLabel,
    )
    expect(sandbox.launchdLabel).not.toBe(
      unitNames("/work/other/.velo-dev", "/home/me/.velo", "api").launchdLabel,
    )
  })
})

describe("renderLaunchdPlist", () => {
  const plist = renderLaunchdPlist("dev.starktech.velo.dashboard", spec)

  it("runs node with absolute paths and the service's arguments", () => {
    expect(plist).toContain("<key>Label</key>\n  <string>dev.starktech.velo.dashboard</string>")
    expect(plist).toContain(
      [
        "    <string>/opt/node 22/bin/node</string>",
        "    <string>/usr/lib/node_modules/@starktech/velo-dashboard/dist/main.js</string>",
        "    <string>--port</string>",
        "    <string>4318</string>",
      ].join("\n"),
    )
  })

  it("starts at login and restarts only after a failure", () => {
    expect(plist).toContain("<key>RunAtLoad</key>\n  <true/>")
    expect(plist).toContain(
      "<key>KeepAlive</key>\n  <dict>\n    <key>SuccessfulExit</key>\n    <false/>",
    )
  })

  it("logs to the shared service log and escapes XML in values", () => {
    expect(plist).toContain(
      "<key>StandardOutPath</key>\n  <string>/home/me/.velo/run/dashboard.log</string>",
    )
    expect(plist).toContain("<string>/data/a&amp;b</string>")
    expect(plist).not.toContain("a&b")
  })

  it("omits the environment block when there is none", () => {
    expect(renderLaunchdPlist("x", { ...spec, env: {} })).not.toContain("EnvironmentVariables")
  })
})

describe("renderLaunchdPlist with a launcher", () => {
  it("runs only the launcher, so macOS names the login item after it, not after node", () => {
    const plist = renderLaunchdPlist(
      "dev.starktech.velo.dashboard",
      spec,
      "/home/me/.velo/launchers/velo-dashboard",
    )
    expect(plist).toContain(
      "<array>\n    <string>/home/me/.velo/launchers/velo-dashboard</string>\n  </array>",
    )
    expect(plist).not.toContain("/opt/node 22/bin/node")
    expect(plist).not.toContain("--port")
  })
})

describe("renderLauncherScript", () => {
  it("is a shell script that hands over to node, and says why it exists", () => {
    const script = renderLauncherScript({ ...spec, service: "api" })
    expect(script.startsWith("#!/bin/sh\n")).toBe(true)
    expect(script).toContain("velo-api")
    expect(script).toContain("Node.js Foundation")
    expect(script).toMatch(
      /\nexec '\/opt\/node 22\/bin\/node' '\/usr\/lib\/node_modules\/.*\/main\.js' '--port' '4318'/,
    )
  })

  it("passes every argument through a real shell unchanged, whatever characters it holds", () => {
    const nasty = [
      "it's a test",
      "$HOME",
      "`echo hi`",
      'say "hi"',
      "a b",
      "*",
      "semi;colon",
      "new\nline",
      "back\\slash",
      "",
    ]
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-launcher-"))
    try {
      const file = path.join(dir, "velo-api")
      // printf prints each argument NUL-terminated, so we can compare them exactly
      fs.writeFileSync(
        file,
        renderLauncherScript({
          ...spec,
          execPath: "/usr/bin/printf",
          script: "%s\\0",
          args: nasty,
        }),
        { mode: 0o755 },
      )
      const out = execFileSync(file, [], { encoding: "utf8" })
      expect(out.split("\0").slice(0, -1)).toEqual(nasty)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("renderSystemdUnit", () => {
  it("quotes arguments and restarts only on failure", () => {
    const unit = renderSystemdUnit(spec, "velo-api.service")
    expect(unit).toContain(
      'ExecStart="/opt/node 22/bin/node" /usr/lib/node_modules/@starktech/velo-dashboard/dist/main.js --port 4318 --api-url http://127.0.0.1:4317',
    )
    expect(unit).toContain("Restart=on-failure")
    expect(unit).toContain("WantedBy=default.target")
    expect(unit).toContain("StandardOutput=append:/home/me/.velo/run/dashboard.log")
  })

  it("orders the dashboard after the API without making it a hard dependency", () => {
    const unit = renderSystemdUnit(spec, "velo-api.service")
    expect(unit).toContain("After=velo-api.service\nWants=velo-api.service")
    expect(unit).not.toContain("Requires=")
    expect(renderSystemdUnit({ ...spec, service: "api" })).not.toContain("After=")
  })

  it("passes environment variables", () => {
    expect(renderSystemdUnit(spec)).toContain(`Environment="VELO_HOME=/data/a&b"`)
  })
})

describe("systemdQuote", () => {
  it("leaves simple arguments alone and escapes the special ones", () => {
    expect(systemdQuote("/usr/bin/node")).toBe("/usr/bin/node")
    expect(systemdQuote("--port")).toBe("--port")
    expect(systemdQuote("has space")).toBe('"has space"')
    expect(systemdQuote('say "hi"')).toBe('"say \\"hi\\""')
    expect(systemdQuote("100%")).toBe('"100%%"')
    expect(systemdQuote("$HOME")).toBe('"$$HOME"')
    expect(systemdQuote("back\\slash")).toBe('"back\\\\slash"')
  })
})
