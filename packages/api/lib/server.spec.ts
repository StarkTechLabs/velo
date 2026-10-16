import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { Config, configSchema } from "@starktech/core"

import { startServer } from "./server"

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-api-"))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

const config = (): Config =>
  configSchema.parse({ databaseFilePath: path.join(dir, "db.sqlite"), api: { port: 4317 } })

describe("startServer", () => {
  it("listens on loopback, serves requests against the real database file, and shuts down", async () => {
    const c = config()
    c.api.port = 0 // ephemeral
    const running = await startServer(c, { log: () => {} })
    try {
      const base = `http://127.0.0.1:${running.port}`
      const health = await (await fetch(`${base}/api/health`)).json()
      expect(health).toMatchObject({ name: "velo-api", databaseFilePath: c.databaseFilePath })

      const created = await fetch(`${base}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "p", timeframe: "1h" }),
      })
      expect(created.status).toBe(201)
    } finally {
      await running.close()
    }
    expect(fs.existsSync(c.databaseFilePath)).toBe(true)
    await expect(fetch(`http://127.0.0.1:${running.port}/api/health`)).rejects.toThrow()
  })

  it("fails with EADDRINUSE when the port is taken", async () => {
    const c = config()
    c.api.port = 0
    const first = await startServer(c, { log: () => {} })
    try {
      const second = { ...c, api: { ...c.api, port: first.port } }
      await expect(startServer(second, { log: () => {} })).rejects.toMatchObject({
        code: "EADDRINUSE",
      })
    } finally {
      await first.close()
    }
  })
})
