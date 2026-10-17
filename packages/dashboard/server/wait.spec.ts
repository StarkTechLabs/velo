// @vitest-environment node
import * as http from "node:http"
import type { AddressInfo } from "node:net"

import { waitForApi } from "./wait"

const servers: http.Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))))
})

const listen = (port: number, status = 200) =>
  new Promise<http.Server>((resolve) => {
    const s = http
      .createServer((req, res) => res.writeHead(req.url === "/api/health" ? status : 404).end("{}"))
      .listen(port, "127.0.0.1", () => resolve(s))
    servers.push(s)
  })

const freePort = async () => {
  const s = await listen(0)
  const { port } = s.address() as AddressInfo
  await new Promise((r) => s.close(r))
  servers.pop()
  return port
}

describe("waitForApi", () => {
  it("returns right away when the API is up", async () => {
    const s = await listen(0)
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`
    const started = Date.now()
    expect(await waitForApi(url, 5)).toBe(true)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it("waits for an API that comes up late, and says it is waiting", async () => {
    const port = await freePort()
    const lines: string[] = []
    setTimeout(() => void listen(port), 400)
    const up = await waitForApi(`http://127.0.0.1:${port}/`, 5, {
      log: (l) => lines.push(l),
      intervalMs: 100,
    })
    expect(up).toBe(true)
    expect(lines).toEqual([`waiting up to 5s for the velo API at http://127.0.0.1:${port}/`])
  })

  it("gives up after the timeout so the dashboard starts anyway", async () => {
    const port = await freePort()
    const started = Date.now()
    expect(await waitForApi(`http://127.0.0.1:${port}`, 1, { intervalMs: 100 })).toBe(false)
    expect(Date.now() - started).toBeGreaterThanOrEqual(900)
  })

  it("treats an unhealthy answer as not ready", async () => {
    const s = await listen(0, 503)
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`
    expect(await waitForApi(url, 1, { intervalMs: 100 })).toBe(false)
  })
})
