import { EventFilter, parseDateInput } from "@starktech/core"
import type { Request } from "express"

import { HttpError } from "./errors"

const strings = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (v): v is string => typeof v === "string" && v !== "",
  )

const last = (value: unknown): string | undefined => strings(value).at(-1)

const date = (name: string, value: unknown, edge: "start" | "end"): Date | undefined => {
  const raw = last(value)
  if (!raw) return undefined
  try {
    return parseDateInput(raw, edge)
  } catch {
    throw new HttpError(400, `${name}: invalid date "${raw}"`)
  }
}

/** Filter shared by list, stats and export: term, project (repeatable), min_date, max_date. */
export const filterFromQuery = (req: Request): EventFilter => {
  const projects = strings(req.query.project)
  return {
    term: last(req.query.term),
    projects: projects.length ? projects : undefined,
    minDate: date("min_date", req.query.min_date, "start"),
    maxDate: date("max_date", req.query.max_date, "end"),
  }
}
