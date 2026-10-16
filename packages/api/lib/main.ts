import { parseArgs } from "node:util"

import { Config, ensureConfig, errorMessage } from "@starktech/core"

import { isLoopbackHost } from "./security"
import { VERSION, startServer } from "./server"

const HELP = `velo-api ${VERSION}

Usage: velo-api [--host <host>] [--port <port>]

Starts the velo REST API. Defaults come from ~/.velo/config.json (api.host, api.port).
Binds to 127.0.0.1 by default; there is no authentication, so do not expose it to a network.
`

const main = async () => {
  const { values } = parseArgs({
    options: {
      host: { type: "string" },
      port: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  })
  if (values.help) return console.log(HELP)
  if (values.version) return console.log(VERSION)

  const config: Config = ensureConfig()
  if (values.host) config.api.host = values.host
  if (values.port) {
    const port = Number(values.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`Invalid port "${values.port}"`)
    }
    config.api.port = port
  }
  if (!isLoopbackHost(config.api.host)) {
    console.warn(
      `warning: listening on ${config.api.host}. The API has no authentication; anyone who can reach it can read and change your data.`,
    )
  }

  const running = await startServer(config)
  console.log(`velo-api ${VERSION} listening on http://${config.api.host}:${running.port}`)

  let stopping = false
  const stop = (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`${signal} received, shutting down`)
    running.close().then(
      () => process.exit(0),
      (err) => {
        console.error(`error: ${errorMessage(err)}`)
        process.exit(1)
      },
    )
  }
  process.on("SIGTERM", () => stop("SIGTERM"))
  process.on("SIGINT", () => stop("SIGINT"))
}

main().catch((err) => {
  const message =
    err?.code === "EADDRINUSE" ? `port ${err.port} is already in use` : errorMessage(err)
  console.error(process.env.VELO_DEBUG ? err : `error: ${message}`)
  process.exit(1)
})
