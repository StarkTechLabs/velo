import * as fs from "node:fs"

import { errorMessage, getConfig } from "@starktech/core"

import { browser } from "@/services/browser"
import { logFile, readPid } from "@/services/files"
import { serviceDeps } from "@/services/manage"
import { NotInstalledError } from "@/services/resolve"
import { FAKE_SERVICE, useFakeServices } from "@/testing/fakeServices"
import { runCli } from "@/testing/run"

const fake = useFakeServices()
const cli = (...args: string[]) => runCli(args, fake.config)
const apiUp = async () =>
  (await fetch(`http://127.0.0.1:${fake.config.api.port}/api/health`).catch(() => null))?.ok ??
  false

afterEach(async () => {
  process.exitCode = undefined
  await cli("stop")
})

describe("status", () => {
  it("shows both services as stopped, or JSON", async () => {
    const { out } = await cli("status")
    expect(out).toMatch(/API\s+stopped\s+http:\/\/127\.0\.0\.1:\d+/)
    expect(out).toMatch(/Dashboard\s+stopped\s+http:\/\/localhost:\d+/)
    const json = JSON.parse((await cli("status", "--json")).out)
    expect(json.map((s: { name: string; state: string }) => [s.name, s.state])).toEqual([
      ["api", "stopped"],
      ["dashboard", "stopped"],
    ])
  })

  it("shows pids and versions for running services and 'not installed' for missing ones", async () => {
    await cli("api", "start")
    serviceDeps.resolveBin = (def) => {
      throw new NotInstalledError(def)
    }
    const { out } = await cli("status")
    expect(out).toMatch(
      new RegExp(`API\\s+running\\s+\\S+\\s+pid ${readPid("api")}\\s+v0\\.0\\.0-test`),
    )
    expect(out).toMatch(/Dashboard\s+not installed/)
  })

  it("`<service> status` exits 1 unless running", async () => {
    await cli("api", "status")
    expect(process.exitCode).toBe(1)
    process.exitCode = undefined

    await cli("api", "start")
    const { out } = await cli("api", "status")
    expect(out).toContain("running")
    expect(process.exitCode).toBeUndefined()
  })
})

describe("api start / stop / restart", () => {
  it("starts, reports an existing instance, restarts with a new pid, and stops", async () => {
    const first = await cli("api", "start")
    expect(first.out).toMatch(/API started at http:\/\/127\.0\.0\.1:\d+ \(pid \d+\)/)
    expect(first.out).toContain("Logs: velo api logs")
    const pid = readPid("api")

    expect((await cli("api", "start")).out).toContain(`API already running at`)

    const restarted = await cli("api", "restart")
    expect(restarted.out).toContain("API stopped")
    expect(restarted.out).toContain("API started")
    expect(readPid("api")).not.toBe(pid)

    expect((await cli("api", "stop")).out).toBe("API stopped")
    expect((await cli("api", "stop")).out).toBe("API is not running")
    expect(await apiUp()).toBe(false)
  })
})

describe("dashboard start", () => {
  it("starts the API first", async () => {
    expect(await apiUp()).toBe(false)
    const { out } = await cli("dashboard", "start")
    expect(out.indexOf("API started")).toBeGreaterThanOrEqual(0)
    expect(out.indexOf("Dashboard started")).toBeGreaterThan(out.indexOf("API started"))
    expect(await apiUp()).toBe(true)
  })

  it("leaves a running API alone and skips it with --no-api", async () => {
    await cli("dashboard", "start", "--no-api")
    expect(await apiUp()).toBe(false)
    expect((await cli("status", "--json")).out).toContain('"state": "running"')
  })

  it("does not start the dashboard when the API cannot start", async () => {
    process.env.FAKE_MODE = "exit"
    const { failure } = await cli("dashboard", "start")
    expect(failure?.message).toContain("The API exited during startup")
    expect(readPid("dashboard")).toBeNull()
  })

  it("explains how to install a missing dashboard", async () => {
    serviceDeps.resolveBin = (def) => {
      if (def.name === "dashboard") throw new NotInstalledError(def)
      return FAKE_SERVICE
    }
    const { failure } = await cli("dashboard", "start")
    expect(failure?.message).toContain("npm install -g @starktech/velo-dashboard")
    expect(await apiUp()).toBe(false) // no side effects
  })
})

describe("start / stop (both)", () => {
  it("starts the api and dashboard, then stops dashboard before api", async () => {
    const started = await cli("start")
    expect(started.out).toContain("API started")
    expect(started.out).toContain("Dashboard started")

    const stopped = await cli("stop")
    expect(stopped.out.split("\n")).toEqual(["Dashboard stopped", "API stopped"])
  })

  it("skips a dashboard that isn't installed", async () => {
    serviceDeps.resolveBin = (def) => {
      if (def.name === "dashboard") throw new NotInstalledError(def)
      return FAKE_SERVICE
    }
    const { out, failure } = await cli("start")
    expect(failure).toBeUndefined()
    expect(out).toContain("API started")
    expect(out).toContain("Dashboard not installed; skipping")
  })
})

describe("open", () => {
  it("starts everything and opens the dashboard url", async () => {
    const open = jest.spyOn(browser, "open").mockImplementation(() => {})
    const { out } = await cli("open")
    expect(open).toHaveBeenCalledWith(`http://localhost:${fake.config.dashboard.port}`)
    expect(out).toContain("Opening http://localhost:")
    expect(await apiUp()).toBe(true)
    open.mockRestore()
  })
})

describe("logs", () => {
  it("says so when there is no log, then prints the last lines", async () => {
    expect((await cli("api", "logs")).out).toContain("No API log yet")

    await cli("api", "start")
    expect((await cli("api", "logs")).out).toContain("velo-api listening on")

    fs.appendFileSync(
      logFile("api"),
      Array.from({ length: 10 }, (_, i) => `line ${i}`).join("\n") + "\n",
    )
    expect((await cli("api", "logs", "-n", "3")).out).toBe("line 7\nline 8\nline 9")
  })
})

describe("configure", () => {
  it("shows config and persists port changes", async () => {
    expect(JSON.parse((await cli("configure", "--list")).out)).toMatchObject({
      api: { host: "127.0.0.1" },
    })

    const { out } = await cli("configure", "--api-port", "5000", "--dashboard-port", "5001")
    expect(out).toContain("Restart running services")
    expect(getConfig()).toMatchObject({ api: { port: 5000 }, dashboard: { port: 5001 } })
  })

  it("rejects invalid values without writing", async () => {
    const bad = await cli("configure", "--api-port", "70000")
    expect(errorMessage(bad.failure)).toContain("api.port: Too big")
    const text = await cli("configure", "--dashboard-port", "abc")
    expect(errorMessage(text.failure)).toContain("dashboard.port")
    expect(getConfig()).toBeNull()
  })
})
