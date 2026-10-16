import * as fs from "node:fs"
import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"

import { Config, configSchema } from "@starktech/core"

import { ServiceName } from "@/services/definitions"
import { readPid } from "@/services/files"
import { serviceDeps } from "@/services/manage"

export const FAKE_SERVICE = path.join(__dirname, "fakeService.mjs")

export const freePort = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo
      s.close(() => resolve(port))
    })
  })

const original = { ...serviceDeps }

/**
 * Registers hooks that give each test an empty VELO_HOME, free ports, and a fake api/dashboard
 * binary in place of the real ones, and that kill whatever the test left running.
 */
export const useFakeServices = () => {
  const state = { home: "", config: undefined as unknown as Config }

  beforeEach(async () => {
    state.home = fs.mkdtempSync(path.join(os.tmpdir(), "velo-svc-"))
    process.env.VELO_HOME = path.join(state.home, ".velo")
    state.config = configSchema.parse({
      api: { port: await freePort() },
      dashboard: { port: await freePort() },
    })
    process.env.FAKE_API_PORT = String(state.config.api.port)
    delete process.env.FAKE_MODE
    Object.assign(serviceDeps, original, { resolveBin: () => FAKE_SERVICE })
  })

  afterEach(() => {
    for (const name of ["api", "dashboard"] as ServiceName[]) {
      const pid = readPid(name)
      if (pid && pid !== process.pid) {
        try {
          process.kill(pid, "SIGKILL")
        } catch {
          // already gone
        }
      }
    }
    delete process.env.VELO_HOME
    delete process.env.FAKE_API_PORT
    delete process.env.FAKE_MODE
    fs.rmSync(state.home, { recursive: true, force: true })
  })

  return state
}
