import { Command } from "commander"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

import { registerCommands } from "@/commands"
import { ensureConfig } from "@starktech/core"

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const program = new Command()

const config = ensureConfig()

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

program
  .name("velo")
  .description("A CLI to track and manage your time.")
  .version(getVersion(), "-v, --version")

registerCommands(program, config)

// Parse command-line arguments
program.parse()
