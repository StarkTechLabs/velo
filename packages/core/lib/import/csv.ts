import { createHash } from "node:crypto"

import { CreateEvent } from "../types"

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, embedded newlines, CRLF. */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (quoted) throw new Error("Malformed CSV: unterminated quoted field")
  if (field !== "" || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "")
}

const minutesToTimeframe = (minutes: number): string => `${parseFloat(minutes.toFixed(2))}m`

const stableId = (parts: string[], seen: Map<string, number>): string => {
  const hash = createHash("sha1").update(JSON.stringify(parts)).digest("hex")
  const n = seen.get(hash) ?? 0
  seen.set(hash, n + 1)
  return `csv-${hash.slice(0, 24)}${n ? `-${n}` : ""}`
}

export type CsvFormat = "velo" | "busywork"

/**
 * Converts CSV text into events. Two layouts are recognized by their header:
 *  - `date,project,description,hours`: `velo export` and the busybee-x/chrono "Export to CSV"
 *    (events are placed at noon on that local day)
 *  - `...,timestamp,...,project,duration,description`: the legacy Busywork Slack log, with
 *    `duration` in minutes
 *
 * Ids are derived from the row content so importing the same file twice is a no-op.
 * Rows that can't be converted are reported rather than aborting the whole file.
 */
export const csvToEvents = (
  text: string,
): { format: CsvFormat; events: CreateEvent[]; errors: { line: number; error: string }[] } => {
  const [header, ...body] = parseCsv(text.replace(/^\uFEFF/u, ""))
  if (!header) throw new Error("CSV is empty")
  const columns = header.map((h) => h.trim().toLowerCase())
  const col = (name: string) => columns.indexOf(name)

  let format: CsvFormat
  if (["date", "project", "description", "hours"].every((c) => col(c) >= 0)) format = "velo"
  else if (["timestamp", "project", "duration", "description"].every((c) => col(c) >= 0))
    format = "busywork"
  else {
    throw new Error(
      "Unrecognized CSV header. Expected date,project,description,hours or timestamp,project,duration,description",
    )
  }

  const events: CreateEvent[] = []
  const errors: { line: number; error: string }[] = []
  const seen = new Map<string, number>()

  body.forEach((cells, i) => {
    const line = i + 2
    const get = (name: string) => (cells[col(name)] ?? "").trim()
    try {
      let timestamp: string
      let minutes: number
      if (format === "velo") {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(get("date"))
        if (!m) throw new Error(`Invalid date "${get("date")}"`)
        timestamp = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).toISOString()
        minutes = Number(get("hours")) * 60
      } else {
        const ts = new Date(get("timestamp"))
        if (Number.isNaN(ts.getTime())) throw new Error(`Invalid timestamp "${get("timestamp")}"`)
        timestamp = ts.toISOString()
        minutes = Number(get("duration"))
      }
      if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error(`Invalid duration "${get(format === "velo" ? "hours" : "duration")}"`)
      }
      const timeframe = minutesToTimeframe(minutes)
      const project = get("project")
      const description = get("description")
      events.push({
        id: stableId([timestamp, project, description, timeframe], seen),
        timestamp,
        timeframe,
        project,
        description,
      })
    } catch (err) {
      errors.push({ line, error: (err as Error).message })
    }
  })

  return { format, events, errors }
}
