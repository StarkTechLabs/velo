import type { RequestHandler } from "express"

import { HttpError } from "./errors"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

export const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS.has(host.toLowerCase())

/** `localhost:4318` -> hostname without the port, handling bracketed IPv6. */
const hostnameOf = (hostHeader: string): string => {
  const h = hostHeader.toLowerCase()
  return h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1) : h.split(":")[0]
}

/**
 * Rejects requests whose Host header isn't a loopback name. This blocks DNS-rebinding, where a
 * hostile web page resolves its own domain to 127.0.0.1 to reach the API. Skipped when the
 * server is deliberately bound to a non-loopback address.
 */
export const hostGuard =
  (enabled: boolean): RequestHandler =>
  (req, _res, next) => {
    if (!enabled) return next()
    const host = req.headers.host
    if (!host || !isLoopbackHost(hostnameOf(host))) {
      return next(new HttpError(403, "Forbidden host"))
    }
    next()
  }

/**
 * Only the dashboard (and configured extra origins) may call the API from a browser. Requests
 * with no Origin header (curl, the CLI) pass; requests from any other origin are refused outright
 * so that "simple" cross-site requests (form posts) can't write data either.
 */
export const originGuard = (allowedOrigins: string[]): RequestHandler => {
  const allowed = new Set(allowedOrigins)
  return (req, res, next) => {
    const origin = req.headers.origin
    if (!origin) return next()
    if (!allowed.has(origin)) return next(new HttpError(403, "Forbidden origin"))

    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")
      res.setHeader("Access-Control-Max-Age", "600")
      res.status(204).end()
      return
    }
    next()
  }
}

/** Writes must be JSON, which browsers can't send cross-site without a (refused) preflight. */
export const requireJson: RequestHandler = (req, _res, next) => {
  if ((req.method === "POST" || req.method === "PUT") && !req.is("application/json")) {
    return next(new HttpError(415, "Content-Type must be application/json"))
  }
  next()
}
