import type { Server } from "node:http"

import { Config, closeDb, getConfigPath, initDb } from "@starktech/core"

import { createApp } from "./app"
import { isLoopbackHost } from "./security"

declare const __VERSION__: string
export const VERSION = typeof __VERSION__ === "undefined" ? "0.0.0-dev" : __VERSION__

export type RunningServer = { server: Server; port: number; close: () => Promise<void> }

/** Origins the dashboard may be served from, plus VELO_ALLOWED_ORIGINS (comma separated). */
export const allowedOriginsFor = (config: Config): string[] => {
  const port = config.dashboard.port
  const extra = (process.env.VELO_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`, `http://[::1]:${port}`, ...extra]
}

export const startServer = async (
  config: Config,
  { log = (line: string) => console.log(line) }: { log?: (line: string) => void } = {},
): Promise<RunningServer> => {
  await initDb(config)
  const app = createApp({
    version: VERSION,
    databaseFilePath: config.databaseFilePath,
    home: getConfigPath(),
    allowedOrigins: allowedOriginsFor(config),
    checkHost: isLoopbackHost(config.api.host),
    log,
  })

  // Express 5 invokes the listen callback with the error when the server fails to bind
  const server = await new Promise<Server>((resolve, reject) => {
    const s = app.listen(config.api.port, config.api.host, (err?: Error) =>
      err ? reject(err) : resolve(s),
    )
  })
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : config.api.port

  const close = async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      server.closeIdleConnections()
      setTimeout(() => server.closeAllConnections(), 2000).unref()
    })
    await closeDb()
  }
  return { server, port, close }
}
