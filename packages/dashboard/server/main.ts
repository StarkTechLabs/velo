import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

import { startDashboard } from "./server"

declare const __VERSION__: string
const VERSION = typeof __VERSION__ === "undefined" ? "0.0.0-dev" : __VERSION__

const HELP = `velo-dashboard ${VERSION}

Usage: velo-dashboard --port <port> --api-url <url>

Serves the velo dashboard on http://127.0.0.1:<port>. The page talks to the velo API at
<api-url> (default http://127.0.0.1:4317). Start the API first: velo api start
`

const main = async () => {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "4318" },
      "api-url": { type: "string", default: "http://127.0.0.1:4317" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  })
  if (values.help) return console.log(HELP)
  if (values.version) return console.log(VERSION)

  const port = Number(values.port)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid port "${values.port}"`)
  }

  const running = await startDashboard({
    port,
    apiUrl: values["api-url"] as string,
    version: VERSION,
    root: join(dirname(fileURLToPath(import.meta.url)), "app"),
  })
  console.log(`velo-dashboard ${VERSION} listening on http://127.0.0.1:${running.port}`)

  let stopping = false
  const stop = (signal: string) => {
    if (stopping) return
    stopping = true
    console.log(`${signal} received, shutting down`)
    running.close().then(() => process.exit(0))
  }
  process.on("SIGTERM", () => stop("SIGTERM"))
  process.on("SIGINT", () => stop("SIGINT"))
}

main().catch((err) => {
  const message =
    err?.code === "EADDRINUSE" ? `port ${err.port ?? ""} is already in use` : (err?.message ?? err)
  console.error(process.env.VELO_DEBUG ? err : `error: ${message}`)
  process.exit(1)
})
