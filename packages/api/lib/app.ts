import express, { type Express } from "express"

import { errorHandler, notFound } from "./errors"
import { eventsRouter } from "./routes/events"
import { reportsRouter } from "./routes/reports"
import { hostGuard, originGuard, requireJson } from "./security"

export type AppOptions = {
  version: string
  databaseFilePath: string
  /** The velo data directory this API serves (`~/.velo` or `$VELO_HOME`). Reported by /api/health. */
  home?: string
  /** Browser origins allowed to call the API, e.g. the dashboard's. */
  allowedOrigins: string[]
  /** Validate the Host header (on unless the server is bound to a non-loopback address). */
  checkHost?: boolean
  log?: (line: string) => void
}

export const createApp = (options: AppOptions): Express => {
  const log = options.log ?? ((line) => console.log(line))
  const startedAt = Date.now()
  const app = express()
  app.disable("x-powered-by")

  app.use((req, res, next) => {
    const start = Date.now()
    res.on("finish", () =>
      log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`),
    )
    next()
  })
  app.use(hostGuard(options.checkHost ?? true))
  app.use(originGuard(options.allowedOrigins))
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store")
    next()
  })
  app.use(requireJson)
  app.use(express.json())

  app.get("/api/health", (_req, res) => {
    res.json({
      name: "velo-api",
      version: options.version,
      pid: process.pid,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      databaseFilePath: options.databaseFilePath,
      home: options.home ?? null,
    })
  })
  app.use("/api/events", eventsRouter())
  app.use("/api", reportsRouter())

  app.use(notFound)
  app.use(errorHandler(log))
  return app
}
