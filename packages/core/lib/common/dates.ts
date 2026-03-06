export const formatDateTime = (input: string | number | Date | undefined | null) => {
  const val = new Date(input || "")
  const now = new Date()
  const opts: Intl.DateTimeFormatOptions = {
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "2-digit",
    // dayPeriod: "long",
  }

  if (val.getFullYear() != now.getFullYear()) opts.year = "numeric"
  const time = val.toLocaleString("en-US", opts)
  return time
}
