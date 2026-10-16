const pad = (n: number) => String(n).padStart(2, "0")

/** Local `YYYY-MM-DD HH:mm`. */
export const formatWhen = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Last 8 characters of an id: the random tail of a UUID v7. Accepted by edit/rm. */
export const shortId = (id: string): string => id.slice(-8)

export const truncate = (value: string, max: number): string => {
  const oneLine = value.replace(/\s+/g, " ").trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/** Left-aligned plain-text table. */
export const renderTable = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)))
  const line = (cells: string[]) =>
    cells
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ")
      .trimEnd()
  return [line(headers), line(widths.map((w) => "─".repeat(w))), ...rows.map(line)].join("\n")
}

export const printJson = (value: unknown) => console.log(JSON.stringify(value, null, 2))
