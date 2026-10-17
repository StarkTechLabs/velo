import * as fs from "node:fs"
import * as path from "node:path"

import { serviceDeps } from "@/services/manage"
import { useFakeServiceManager } from "@/testing/autostart"
import { useFakeServices } from "@/testing/fakeServices"
import { runCli } from "@/testing/run"

jest.setTimeout(20_000) // these start real processes

const fake = useFakeServices()
const systemd = useFakeServiceManager("systemd")
const cli = (...args: string[]) => runCli(args, fake.config)
const original = { autostart: serviceDeps.autostart }
beforeEach(() => {
  serviceDeps.autostart = original.autostart
})

const unitDir = () => path.join(systemd.home, ".config", "systemd", "user")

describe("service install (systemd)", () => {
  it("writes ordered user units and starts what ExecStart says", async () => {
    const { out, failure } = await cli("service", "install")
    expect(failure).toBeUndefined()
    const units = fs.readdirSync(unitDir()).sort()
    expect(units).toHaveLength(2)
    expect(units[0]).toMatch(/^velo-[0-9a-f]{8}-api\.service$/)

    const dashboard = fs.readFileSync(path.join(unitDir(), units[1]), "utf8")
    expect(dashboard).toContain(`After=${units[0]}`)
    expect(dashboard).toContain(`Wants=${units[0]}`)
    expect(dashboard).toContain("Restart=on-failure")

    const running = await (
      await fetch(`http://127.0.0.1:${fake.config.dashboard.port}/config.json`)
    ).json()
    expect(running.args).toContain("--wait-for-api")
    expect(running.home).toBe(process.env.VELO_HOME)
    expect(out).toContain("sudo loginctl enable-linger $USER")
  })

  it("uninstall disables the units and removes the files", async () => {
    await cli("service", "install")
    await cli("service", "uninstall")
    expect(fs.readdirSync(unitDir())).toEqual([])
    await new Promise((r) => setTimeout(r, 300))
    await expect(fetch(`http://127.0.0.1:${fake.config.api.port}/api/health`)).rejects.toThrow()
  })

  it("`velo api start` uses systemctl start once installed", async () => {
    await cli("service", "install", "api")
    await cli("api", "stop")
    await new Promise((r) => setTimeout(r, 300))
    systemd.calls.length = 0
    const { out } = await cli("api", "start")
    expect(out).toContain("by systemd")
    expect(
      systemd.summary().some((c) => /systemctl --user start velo-[0-9a-f]{8}-api\.service/.test(c)),
    ).toBe(true)
  })

  it("reports the autostart column in status", async () => {
    await cli("service", "install", "api")
    expect((await cli("service", "status")).out).toMatch(/API\s+enabled\s+running/)
    expect((await cli("service", "status")).out).toContain("Managed by systemd")
  })
})
