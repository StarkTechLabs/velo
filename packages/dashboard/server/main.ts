import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

import { startDashboard } from "./server"
import { waitForApi } from "./wait"

declare const __VERSION__: string
const VERSION = typeof __VERSION__ === "undefined" ? "0.0.0-dev" : __VERSION__

const HELP = `velo-dashboard ${VERSION}

Usage: velo-dashboard --port <port> --api-url <url> [--home <dir>] [--wait-for-api <seconds>]

Serves the velo dashboard on http://127.0.0.1:<port>. The page talks to the velo API at
<api-url> (default http://127.0.0.1:4317). Start the API first: velo api start

--wait-for-api <seconds>  hold off starting until the API answers (used by login autostart);
                          starts anyway after the timeout
`

const main = async () => {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "4318" },
      "api-url": { type: "string", default: "http://127.0.0.1:4317" },
      home: { type: "string" },
      "wait-for-api": { type: "string" },
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

  if (values["wait-for-api"] !== undefined) {
    const seconds = Number(values["wait-for-api"])
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error(`Invalid --wait-for-api "${values["wait-for-api"]}"`)
    }
    const up = await waitForApi(values["api-url"] as string, seconds, { log: console.log })
    if (!up) console.log("the API is not answering yet; starting the dashboard anyway")
  }

  const running = await startDashboard({
    port,
    apiUrl: values["api-url"] as string,
    version: VERSION,
    home: values.home,
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
