// Runs before every test file: tests that forget to set VELO_HOME must land in a throwaway
// directory, never in the real ~/.velo (a timed-out test is torn down while its async work still runs).
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

process.env.VELO_TEST_SAFE_HOME = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), "velo-jest-")),
  ".velo",
)
process.env.VELO_HOME = process.env.VELO_TEST_SAFE_HOME
