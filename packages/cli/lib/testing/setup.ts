// Runs before every CLI test file (see jest.config.ts).
//
// Tests must never touch the real machine: not ~/.velo, not ~/Library/LaunchAgents or
// ~/.config/systemd, not launchctl/systemctl. A test that times out is torn down while its async
// work is still running, and that work then sees whatever the environment looks like *after*
// teardown. So the safe state is the default state: every test file starts (and returns to) a
// throwaway data directory and a fake home, and real service managers are unreachable.
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import { autostartDeps } from "@/autostart/manager"

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "velo-jest-"))

/** The data directory tests fall back to; helpers restore this instead of deleting VELO_HOME. */
export const SAFE_VELO_HOME = path.join(sandbox, ".velo")
process.env.VELO_TEST_SAFE_HOME = SAFE_VELO_HOME
process.env.VELO_HOME = SAFE_VELO_HOME
process.env.XDG_CONFIG_HOME = path.join(sandbox, ".config")

autostartDeps.homedir = () => sandbox
autostartDeps.sleep = async () => {} // tests never wait on real timers
autostartDeps.run = async (command, args) => {
  throw new Error(
    `A test tried to run \`${command} ${args.join(" ")}\` on the real system. ` +
      "Use useFakeAutostart/useFakeServiceManager from @/testing/autostart.",
  )
}
