import * as http from "node:http"
import type { AddressInfo } from "node:net"

import { serveStatic } from "./static"

export type DashboardOptions = {
  port: number
  apiUrl: string
  version: string
  /** Directory holding the built single-page app. */
  root: string
}

export type RunningDashboard = { server: http.Server; port: number; close: () => Promise<void> }

/**
 * Serves the built app on 127.0.0.1, plus `/config.json`: the page reads `apiUrl` from it, and
 * the velo CLI uses `name` and `pid` to recognise (and stop) this process.
 */
export const startDashboard = async (options: DashboardOptions): Promise<RunningDashboard> => {
  const files = serveStatic(options.root)
  const server = http.createServer((req, res) => {
    if (req.url?.split("?")[0] === "/config.json") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
      res.end(
        JSON.stringify({
          name: "velo-dashboard",
          version: options.version,
          pid: process.pid,
          apiUrl: options.apiUrl,
        }),
      )
      return
    }
    files(req, res)
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(options.port, "127.0.0.1", resolve)
  })
  const port = (server.address() as AddressInfo).port

  const close = async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeIdleConnections()
      setTimeout(() => server.closeAllConnections(), 2000).unref()
    })
  }
  return { server, port, close }
}
