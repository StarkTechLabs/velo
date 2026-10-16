import * as fs from "node:fs"
import * as http from "node:http"

import { configSchema } from "@starktech/core"

import { SERVICES } from "./definitions"
import { isAlive, logFile, pidFile, readPid, writePid } from "./files"
import { getStatus, serviceDeps, startService, stopService } from "./manage"
import { NotInstalledError } from "./resolve"
import { useFakeServices } from "../testing/fakeServices"

const fake = useFakeServices()
const servers: http.Server[] = []

// the shared hooks run first; this one closes the foreign servers some tests open
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
})

const listenForeign = (port: number, body: unknown) =>
  new Promise<http.Server>((resolve) => {
    const s = http
      .createServer((_req, res) => res.end(JSON.stringify(body)))
      .listen(port, "127.0.0.1", () => resolve(s))
    servers.push(s)
  })

describe("getStatus", () => {
  it("reports stopped, and whether the package is installed", async () => {
    expect(await getStatus("api", fake.config)).toMatchObject({ state: "stopped", installed: true })
    serviceDeps.resolveBin = (def) => {
      throw new NotInstalledError(def)
    }
    expect(await getStatus("dashboard", fake.config)).toMatchObject({
      state: "stopped",
      installed: false,
      url: `http://localhost:${fake.config.dashboard.port}`,
    })
  })
})

describe("startService / stopService", () => {
  it("starts detached, records the pid, is idempotent, and stops", async () => {
    const started = await startService("api", fake.config)
    expect(started.status).toBe("started")
    expect(started.url).toBe(`http://127.0.0.1:${fake.config.api.port}`)
    expect(readPid("api")).toBe(started.pid)
    expect(isAlive(started.pid)).toBe(true)

    expect(await getStatus("api", fake.config)).toMatchObject({
      state: "running",
      pid: started.pid,
      version: "0.0.0-test",
    })
    expect(await startService("api", fake.config)).toMatchObject({
      status: "already-running",
      pid: started.pid,
    })
    expect(fs.readFileSync(logFile("api"), "utf8")).toContain("velo-api listening")

    expect(await stopService("api", fake.config)).toBe("stopped")
    expect(isAlive(started.pid)).toBe(false)
    expect(fs.existsSync(pidFile("api"))).toBe(false)
    expect((await getStatus("api", fake.config)).state).toBe("stopped")
    expect(await stopService("api", fake.config)).toBe("not-running")
  })

  it("passes the configured host, port and api url to the service", async () => {
    await startService("api", fake.config)
    await startService("dashboard", fake.config)
    const res = await fetch(`http://127.0.0.1:${fake.config.dashboard.port}/config.json`)
    const { args } = await res.json()
    expect(args).toEqual([
      "--port",
      String(fake.config.dashboard.port),
      "--api-url",
      `http://127.0.0.1:${fake.config.api.port}`,
    ])
    const api = await (await fetch(`http://127.0.0.1:${fake.config.api.port}/api/health`)).json()
    expect(api.args).toEqual(["--host", "127.0.0.1", "--port", String(fake.config.api.port)])
  })

  it("surfaces the log when the service dies during startup", async () => {
    process.env.FAKE_MODE = "exit"
    const error = await startService("api", fake.config).catch((e) => e)
    expect(error.message).toContain("exited during startup (code 1)")
    expect(error.message).toContain("port 1 is already in use")
    expect(error.message).toContain("velo api logs")
    expect(fs.existsSync(pidFile("api"))).toBe(false)
  })

  it("kills and cleans up a service that never becomes healthy", async () => {
    process.env.FAKE_MODE = "hang"
    serviceDeps.startTimeoutMs = 600
    const error = await startService("api", fake.config).catch((e) => e)
    expect(error.message).toContain("did not become healthy")
    expect(fs.existsSync(pidFile("api"))).toBe(false)
  })

  it("explains how to install a missing package", async () => {
    serviceDeps.resolveBin = (def) => {
      throw new NotInstalledError(def)
    }
    await expect(startService("dashboard", fake.config)).rejects.toThrow(
      "npm install -g @starktech/velo-dashboard",
    )
  })

  it("reports a stop that doesn't take effect, with the pid to kill", async () => {
    process.env.FAKE_MODE = "ignore-term"
    serviceDeps.stopTimeoutMs = 400
    const { pid } = await startService("api", fake.config)
    await expect(stopService("api", fake.config)).rejects.toThrow(`kill -9 ${pid}`)
  })
})

describe("port conflicts and stale state", () => {
  it("refuses to start on, stop, or kill a port held by another program", async () => {
    const foreign = await listenForeign(fake.config.api.port, { name: "something-else", pid: 1 })

    const status = await getStatus("api", fake.config)
    expect(status.state).toBe("conflict")
    expect(status.detail).toContain(`port ${fake.config.api.port} is in use by another program`)

    await expect(startService("api", fake.config)).rejects.toThrow(
      "velo configure --api-port <port>",
    )
    await expect(stopService("api", fake.config)).rejects.toThrow("Not touching it")
    expect(foreign.listening).toBe(true)
  })

  it("treats a non-JSON answer on the port as a conflict", async () => {
    const s = http
      .createServer((_req, res) => res.end("<html>hello</html>"))
      .listen(fake.config.dashboard.port, "127.0.0.1")
    servers.push(s)
    await new Promise((r) => s.once("listening", r))
    expect((await getStatus("dashboard", fake.config)).state).toBe("conflict")
  })

  it("removes a stale pid file but never signals a live, unrelated pid", async () => {
    writePid("api", 2 ** 22 + 1234) // not a real process
    expect(await stopService("api", fake.config)).toBe("not-running")
    expect(fs.existsSync(pidFile("api"))).toBe(false)

    writePid("api", process.pid) // alive, but not serving the api
    expect(await stopService("api", fake.config)).toBe("not-running")
    expect(readPid("api")).toBe(process.pid)
    expect(isAlive(process.pid)).toBe(true)
  })
})

describe("definitions", () => {
  it("connects to loopback when the api is bound to a wildcard address", () => {
    const wide = configSchema.parse({ api: { host: "0.0.0.0", port: 4317 } })
    expect(SERVICES.api.url(wide)).toBe("http://127.0.0.1:4317")
    expect(SERVICES.api.args(wide).slice(0, 2)).toEqual(["--host", "0.0.0.0"])
  })
})
