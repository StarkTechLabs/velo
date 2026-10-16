import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import {
  DEFAULT_API_PORT,
  DEFAULT_DASHBOARD_PORT,
  ensureConfig,
  getConfig,
  getConfigJsonPath,
  writeConfig,
} from "./config"

let home: string

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "velo-config-"))
  process.env.VELO_HOME = path.join(home, ".velo")
})

afterEach(() => {
  delete process.env.VELO_HOME
  fs.rmSync(home, { recursive: true, force: true })
})

describe("config", () => {
  it("returns null before a config exists", () => {
    expect(getConfig()).toBeNull()
  })

  it("ensureConfig writes defaults once", () => {
    const config = ensureConfig()
    expect(config).toEqual({
      databaseFilePath: path.join(process.env.VELO_HOME as string, "userDb.sqlite"),
      api: { host: "127.0.0.1", port: DEFAULT_API_PORT },
      dashboard: { port: DEFAULT_DASHBOARD_PORT },
    })
    expect(fs.existsSync(getConfigJsonPath())).toBe(true)
    expect(ensureConfig()).toEqual(config)
  })

  it("fills in defaults for a legacy config and ignores unknown keys", () => {
    fs.mkdirSync(process.env.VELO_HOME as string, { recursive: true })
    fs.writeFileSync(
      getConfigJsonPath(),
      JSON.stringify({
        defaultUserId: "x",
        databaseFilePath: "/tmp/db.sqlite",
        server: { port: 68586 },
      }),
    )
    expect(getConfig()).toEqual({
      databaseFilePath: "/tmp/db.sqlite",
      api: { host: "127.0.0.1", port: DEFAULT_API_PORT },
      dashboard: { port: DEFAULT_DASHBOARD_PORT },
    })
  })

  it("round-trips through writeConfig", () => {
    const config = {
      databaseFilePath: "/tmp/x.sqlite",
      api: { host: "127.0.0.1", port: 5000 },
      dashboard: { port: 5001 },
    }
    writeConfig(config)
    expect(getConfig()).toEqual(config)
  })

  it("throws a clear error for invalid json or ports", () => {
    fs.mkdirSync(process.env.VELO_HOME as string, { recursive: true })
    fs.writeFileSync(getConfigJsonPath(), "{nope")
    expect(() => getConfig()).toThrow("Could not read")
    fs.writeFileSync(getConfigJsonPath(), JSON.stringify({ api: { port: 70000 } }))
    expect(() => getConfig()).toThrow("api.port")
  })
})
