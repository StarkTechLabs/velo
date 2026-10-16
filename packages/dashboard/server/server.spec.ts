// @vitest-environment node
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { RunningDashboard, startDashboard } from "./server"

let root: string
let outside: string
let running: RunningDashboard
let base: string

beforeEach(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "velo-dash-"))
  root = path.join(tmp, "app")
  outside = path.join(tmp, "secret.txt")
  fs.mkdirSync(path.join(root, "assets"), { recursive: true })
  fs.writeFileSync(path.join(root, "index.html"), "<html>velo</html>")
  fs.writeFileSync(path.join(root, "assets", "index-abc123.js"), "console.log(1)")
  fs.writeFileSync(path.join(root, "favicon.ico"), "ico")
  fs.writeFileSync(outside, "do not serve")
  running = await startDashboard({
    port: 0,
    apiUrl: "http://127.0.0.1:4317",
    version: "1.2.3",
    home: "/tmp/velo-home",
    root,
  })
  base = `http://127.0.0.1:${running.port}`
})

afterEach(async () => {
  await running.close()
  fs.rmSync(path.dirname(root), { recursive: true, force: true })
})

describe("config.json", () => {
  it("identifies the dashboard (for the CLI) and tells the page where the API is", async () => {
    const res = await fetch(`${base}/config.json`)
    expect(res.headers.get("content-type")).toContain("application/json")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(await res.json()).toEqual({
      name: "velo-dashboard",
      version: "1.2.3",
      pid: process.pid,
      apiUrl: "http://127.0.0.1:4317",
      home: "/tmp/velo-home",
    })
  })
})

describe("static files", () => {
  it("serves index.html at / and unknown client routes", async () => {
    for (const url of ["/", "/some/client/route", "/index.html"]) {
      const res = await fetch(base + url)
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      expect(await res.text()).toBe("<html>velo</html>")
    }
  })

  it("serves assets with the right type, and caches fingerprinted ones forever", async () => {
    const asset = await fetch(`${base}/assets/index-abc123.js`)
    expect(asset.headers.get("content-type")).toContain("text/javascript")
    expect(asset.headers.get("cache-control")).toContain("immutable")
    expect(await asset.text()).toBe("console.log(1)")
    expect((await fetch(`${base}/favicon.ico`)).headers.get("cache-control")).toBe("no-cache")
  })

  it("404s a missing file with an extension rather than returning the app", async () => {
    expect((await fetch(`${base}/assets/missing.js`)).status).toBe(404)
  })

  it("answers HEAD without a body and refuses other methods", async () => {
    const head = await fetch(`${base}/`, { method: "HEAD" })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe("")
    const post = await fetch(`${base}/`, { method: "POST" })
    expect(post.status).toBe(405)
    expect(post.headers.get("allow")).toBe("GET, HEAD")
  })

  it("never serves files outside the root", async () => {
    const attempts = [
      "/../secret.txt",
      "/%2e%2e/secret.txt",
      "/assets/..%2f..%2fsecret.txt",
      "/%2e%2e%2fsecret.txt",
      "//etc/passwd",
    ]
    for (const attempt of attempts) {
      // raw socket path so the client doesn't normalise ".." away
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        import("node:http").then(({ request }) => {
          const req = request({ host: "127.0.0.1", port: running.port, path: attempt }, (r) => {
            let body = ""
            r.on("data", (c) => (body += c))
            r.on("end", () => resolve({ status: r.statusCode ?? 0, body }))
          })
          req.on("error", reject).end()
        })
      })
      expect(res.body, attempt).not.toContain("do not serve")
      expect(res.body, attempt).not.toContain("root:")
    }
  })

  it("explains when the app hasn't been built", async () => {
    fs.rmSync(path.join(root, "index.html"))
    const res = await fetch(`${base}/`)
    expect(res.status).toBe(404)
    expect(await res.text()).toContain("Dashboard files not found")
  })

  it("rejects a malformed URL encoding", async () => {
    const { request } = await import("node:http")
    const status = await new Promise<number>((resolve) =>
      request({ host: "127.0.0.1", port: running.port, path: "/%E0%A4%A" }, (r) =>
        resolve(r.statusCode ?? 0),
      ).end(),
    )
    expect(status).toBe(400)
  })
})

describe("startDashboard", () => {
  it("binds loopback only and fails when the port is taken", async () => {
    expect((running.server.address() as { address: string }).address).toBe("127.0.0.1")
    await expect(
      startDashboard({ port: running.port, apiUrl: "", version: "x", root }),
    ).rejects.toMatchObject({ code: "EADDRINUSE" })
  })
})
