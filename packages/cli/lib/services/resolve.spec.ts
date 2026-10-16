import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { SERVICES } from "./definitions"
import { NotInstalledError, resolveBin } from "./resolve"

let dir: string
const originalPath = process.env.PATH
const originalArgv = process.argv[1]

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "velo-resolve-"))
  // resolve from an isolated location so only PATH can satisfy the lookup
  fs.mkdirSync(path.join(dir, "elsewhere"))
  process.argv[1] = path.join(dir, "elsewhere", "velo.js")
  fs.writeFileSync(process.argv[1], "")
})
afterEach(() => {
  process.env.PATH = originalPath
  process.argv[1] = originalArgv
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("resolveBin", () => {
  it("finds a bin on PATH and follows the symlink to the real script", () => {
    const target = path.join(dir, "lib", "main.js")
    fs.mkdirSync(path.dirname(target))
    fs.writeFileSync(target, "")
    fs.mkdirSync(path.join(dir, "bin"))
    fs.symlinkSync(target, path.join(dir, "bin", "velo-api"))
    process.env.PATH = path.join(dir, "bin")
    expect(resolveBin(SERVICES.api)).toBe(fs.realpathSync(target))
  })

  it("finds an installed package via node_modules above the CLI", () => {
    const pkg = path.join(dir, "node_modules", "@starktech", "velo-dashboard")
    fs.mkdirSync(path.join(pkg, "dist"), { recursive: true })
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({
        name: "@starktech/velo-dashboard",
        bin: { "velo-dashboard": "dist/main.js" },
      }),
    )
    fs.writeFileSync(path.join(pkg, "dist", "main.js"), "")
    process.env.PATH = ""
    expect(resolveBin(SERVICES.dashboard)).toBe(fs.realpathSync(path.join(pkg, "dist", "main.js")))
  })

  it("says the package is unbuilt when its bin file is missing", () => {
    const pkg = path.join(dir, "node_modules", "@starktech", "velo-api")
    fs.mkdirSync(pkg, { recursive: true })
    fs.writeFileSync(
      path.join(pkg, "package.json"),
      JSON.stringify({ name: "@starktech/velo-api", bin: { "velo-api": "dist/main.js" } }),
    )
    process.env.PATH = ""
    expect(() => resolveBin(SERVICES.api)).toThrow("has it been built?")
  })

  it("throws NotInstalledError with the install command", () => {
    process.env.PATH = ""
    expect(() => resolveBin(SERVICES.dashboard)).toThrow(NotInstalledError)
    expect(() => resolveBin(SERVICES.dashboard)).toThrow("npm install -g @starktech/velo-dashboard")
  })
})
