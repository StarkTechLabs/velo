import { Command } from "commander"

import { registerCommands } from "@/commands"
import { VERSION } from "@/version"
import { closeDb, ensureConfig, errorMessage, initDb } from "@starktech/core"

async function main() {
  const config = ensureConfig()
  await initDb(config)

  const program = new Command()
  program
    .name("velo")
    .description("A CLI to track and manage your time.")
    .version(VERSION, "-v, --version")

  registerCommands(program, config)

  try {
    await program.parseAsync()
  } finally {
    await closeDb()
  }
}

main()
  .then(() => {
    process.exit(process.exitCode ?? 0)
  })
  .catch((err) => {
    console.error(process.env.VELO_DEBUG ? err : `error: ${errorMessage(err)}`)
    process.exit(1)
  })
