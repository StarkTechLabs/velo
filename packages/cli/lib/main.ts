import { Command } from "commander"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

import { registerCommands } from "@/commands"
import { ensureConfig, initDb } from "@starktech/core"

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read version from package.json
export const getVersion = (): string => {
  try {
    const packageJsonPath = path.resolve(__dirname, "../package.json")
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
    return packageJson.version || "0.0.0"
  } catch (error) {
    console.error("Error reading package.json:", error)
    return "0.0.0"
  }
}

async function main() {
  const config = ensureConfig()
  await initDb(config)

  const program = new Command()
  program
    .name("velo")
    .description("A CLI to track and manage your time.")
    .version(getVersion(), "-v, --version")

  registerCommands(program, config)

  await program.parseAsync()
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
