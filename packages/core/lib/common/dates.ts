export const formatDateTime = (input: string | number | Date | undefined | null) => {
  const val = new Date(input || "")
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
  }

  if (val.getFullYear() != now.getFullYear()) opts.year = "numeric"
  const time = val.toLocaleString("en-US", opts)
  return time
}

/** Local calendar date as YYYY-MM-DD. */
export const localDateKey = (input: string | number | Date): string => {
  const d = new Date(input)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const startOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export const endOfDay = (date: Date = new Date()): Date => {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}
