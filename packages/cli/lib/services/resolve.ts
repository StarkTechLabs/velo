import * as fs from "node:fs"
import { createRequire } from "node:module"
import * as path from "node:path"

import { ServiceDef } from "./definitions"

export class NotInstalledError extends Error {
  constructor(def: ServiceDef, reason?: string) {
    super(
      `The ${def.label} is not installed${reason ? ` (${reason})` : ""}.\n` +
        `Install it with: npm install -g ${def.packageName}`,
    )
  }
}

const findOnPath = (binName: string): string | null => {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, binName)
    if (dir && fs.existsSync(candidate)) return fs.realpathSync(candidate)
  }
  return null
}

/**
 * Absolute path of the JavaScript file to run for a service: found as an installed package
 * next to (or above) this CLI, which covers global installs and the monorepo, else as a bin
 * on PATH. Throws NotInstalledError when neither exists.
 */
export const resolveBin = (def: ServiceDef): string => {
  const entry = process.argv[1]
  const from =
    entry && fs.existsSync(entry) ? fs.realpathSync(entry) : path.join(process.cwd(), "x")
  let missingBuild: string | undefined
  try {
    const pkgPath = createRequire(from).resolve(`${def.packageName}/package.json`)
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[def.binName]
    const script = bin && path.resolve(path.dirname(pkgPath), bin)
    if (script && fs.existsSync(script)) return script
    missingBuild = `found ${pkgPath} but ${bin ?? "its bin"} is missing; has it been built?`
  } catch {
    // not resolvable as a package
  }
  const onPath = findOnPath(def.binName)
  if (onPath) return onPath
  throw new NotInstalledError(def, missingBuild)
}
