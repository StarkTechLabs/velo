// Keeps the published packages on one version.
//
//   node scripts/set-version.mjs 0.2.0            set root + cli + api + dashboard, update the lockfile
//   node scripts/set-version.mjs 0.2.0 --no-lock  same, without touching package-lock.json
//   node scripts/set-version.mjs --check v0.2.0   exit 1 unless every package is at 0.2.0 (used by the release workflow)
//
// A leading "v" is accepted so a git tag can be passed as-is. `--root <dir>` points it at another
// checkout (the tests use this).
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

export const PACKAGE_DIRS = [".", "packages/cli", "packages/api", "packages/dashboard"]
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

export const normalize = (input) => {
  const version = String(input ?? "").replace(/^v/, "")
  if (!SEMVER.test(version)) {
    throw new Error(`"${input}" is not a version like 1.2.3 or 1.2.3-beta.1`)
  }
  return version
}

const manifest = (root, dir) => join(root, dir, "package.json")

export const readVersions = (root) =>
  Object.fromEntries(
    PACKAGE_DIRS.map((dir) => [
      JSON.parse(readFileSync(manifest(root, dir), "utf8")).name,
      JSON.parse(readFileSync(manifest(root, dir), "utf8")).version,
    ]),
  )

export const setVersion = (root, version) => {
  for (const dir of PACKAGE_DIRS) {
    const file = manifest(root, dir)
    const pkg = JSON.parse(readFileSync(file, "utf8"))
    pkg.version = version
    writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")
  }
}

export const checkVersion = (root, version) =>
  Object.entries(readVersions(root))
    .filter(([, actual]) => actual !== version)
    .map(([name, actual]) => `${name} is ${actual}, expected ${version}`)

const main = () => {
  const args = process.argv.slice(2)
  const take = (flag) => {
    const i = args.indexOf(flag)
    if (i === -1) return undefined
    return args.splice(i, 1)[0] && flag
  }
  const rootIndex = args.indexOf("--root")
  const root =
    rootIndex === -1 ? resolve(import.meta.dirname, "..") : resolve(args.splice(rootIndex, 2)[1])
  const check = take("--check")
  const noLock = take("--no-lock")
  const version = normalize(args[0])

  if (check) {
    const problems = checkVersion(root, version)
    if (problems.length) {
      console.error(`Version mismatch:\n  ${problems.join("\n  ")}`)
      process.exit(1)
    }
    console.log(`All packages are at ${version}`)
    return
  }

  setVersion(root, version)
  if (!noLock)
    execFileSync("npm", ["install", "--package-lock-only", "--ignore-scripts"], {
      cwd: root,
      stdio: "inherit",
    })
  console.log(`Set ${PACKAGE_DIRS.length} packages to ${version}. Review with: git diff`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main()
  } catch (err) {
    console.error(`error: ${err.message}`)
    process.exit(1)
  }
}
