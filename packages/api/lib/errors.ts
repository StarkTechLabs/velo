import type { ErrorRequestHandler, RequestHandler } from "express"
import { ZodError } from "zod"

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" })
}

export const errorHandler =
  (log: (line: string) => void): ErrorRequestHandler =>
  (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      const issues = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
      const error = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ")
      res.status(400).json({ error, issues })
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message })
    } else if (err?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body is not valid JSON" })
    } else if (err?.type === "entity.too.large") {
      res.status(413).json({ error: "Request body too large" })
    } else {
      log(`error: ${err?.stack ?? err}`)
      res.status(500).json({ error: "Internal server error" })
    }
  }
