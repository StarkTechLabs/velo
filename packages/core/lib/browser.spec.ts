import { readFileSync } from "node:fs"
import * as path from "node:path"

// The dashboard bundles this entry for the browser, so it must stay free of node-only modules.
describe("browser entry", () => {
  const seen = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) {
      if (/^(?:import|export)\s+type\s/.test(match[0])) continue // erased at build time
      const spec = match[1]
      if (spec.startsWith(".")) walk(path.resolve(path.dirname(file), spec) + ".ts")
      else expect(spec).not.toMatch(/^(node:|fs$|path$|os$|crypto$|knex|better-sqlite3|zod)/)
    }
  }

  it("only reaches browser-safe modules", () => {
    walk(path.join(__dirname, "browser.ts"))
    expect(seen.size).toBeGreaterThan(3)
  })

  it("exposes grouping and timeframe helpers", async () => {
    const mod = await import("./browser")
    expect(Object.keys(mod)).toEqual(
      expect.arrayContaining(["groupEvents", "eventsToCsv", "parseTimeframe", "localDateKey"]),
    )
  })
})
