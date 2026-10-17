import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { PACKAGE_DIRS, checkVersion, normalize, readVersions, setVersion } from "./set-version.mjs"

const SCRIPT = join(import.meta.dirname, "set-version.mjs")

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "velo-version-"))
  for (const dir of PACKAGE_DIRS) {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(
      join(root, dir, "package.json"),
      JSON.stringify(
        { name: dir === "." ? "velo-repo" : `@starktech/${dir.split("/")[1]}`, version: "0.1.0" },
        null,
        2,
      ),
    )
  }
  return root
}

test("normalize accepts versions and tags, rejects everything else", () => {
  assert.equal(normalize("1.2.3"), "1.2.3")
  assert.equal(normalize("v1.2.3"), "1.2.3")
  assert.equal(normalize("v1.2.3-beta.1"), "1.2.3-beta.1")
  for (const bad of ["", undefined, "1.2", "1.2.3.4", "latest", "v", "1.2.3-"]) {
    assert.throws(() => normalize(bad), /not a version/, String(bad))
  }
})

test("setVersion updates every package and nothing else", () => {
  const root = fixture()
  try {
    setVersion(root, "0.2.0")
    assert.deepEqual(Object.values(readVersions(root)), ["0.2.0", "0.2.0", "0.2.0", "0.2.0"])
    assert.equal(
      JSON.parse(readFileSync(join(root, "packages/cli/package.json"), "utf8")).name,
      "@starktech/cli",
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("checkVersion names the packages that disagree", () => {
  const root = fixture()
  try {
    assert.deepEqual(checkVersion(root, "0.1.0"), [])
    writeFileSync(
      join(root, "packages/api/package.json"),
      JSON.stringify({ name: "@starktech/api", version: "0.1.1" }),
    )
    assert.deepEqual(checkVersion(root, "0.1.0"), ["@starktech/api is 0.1.1, expected 0.1.0"])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the command line sets, checks, and refuses a bad version", () => {
  const root = fixture()
  try {
    execFileSync("node", [SCRIPT, "v0.3.0", "--no-lock", "--root", root], { stdio: "pipe" })
    assert.equal(Object.values(readVersions(root))[0], "0.3.0")

    const ok = spawnSync("node", [SCRIPT, "--check", "v0.3.0", "--root", root], {
      encoding: "utf8",
    })
    assert.equal(ok.status, 0)
    assert.match(ok.stdout, /All packages are at 0.3.0/)

    const mismatch = spawnSync("node", [SCRIPT, "--check", "v0.4.0", "--root", root], {
      encoding: "utf8",
    })
    assert.equal(mismatch.status, 1)
    assert.match(mismatch.stderr, /Version mismatch/)

    const bad = spawnSync("node", [SCRIPT, "nope", "--no-lock", "--root", root], {
      encoding: "utf8",
    })
    assert.equal(bad.status, 1)
    assert.match(bad.stderr, /not a version/)
    assert.equal(Object.values(readVersions(root))[0], "0.3.0") // untouched
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
