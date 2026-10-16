import { Config, configSchema } from "@starktech/core"
import { Command } from "commander"

import { registerCommands } from "@/commands"

/** Runs `velo <args>` in-process against the db set with `setDb`, returning what it printed. */
export const runCli = async (args: string[], config: Config = configSchema.parse({})) => {
  const out: string[] = []
  const err: string[] = []
  const log = jest.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")))
  const error = jest
    .spyOn(console, "error")
    .mockImplementation((...a) => void err.push(a.join(" ")))
  const stdout = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    out.push(String(chunk).replace(/\n$/, ""))
    return true
  })

  const program = new Command()
  program.exitOverride().configureOutput({
    writeOut: (s) => void out.push(s),
    writeErr: (s) => void err.push(s),
  })
  registerCommands(program, config)

  let failure: Error | undefined
  try {
    await program.parseAsync(args, { from: "user" })
  } catch (e) {
    failure = e as Error
  } finally {
    log.mockRestore()
    error.mockRestore()
    stdout.mockRestore()
  }
  return { out: out.join("\n"), err: err.join("\n"), failure }
}
