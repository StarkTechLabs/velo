import { TimeframeData } from "../types"

export const parseTimeframe = (timeframe: string): TimeframeData => {
  // Parse timeframe (e.g., "1h", "30m", "2d", "1.5h", "0.5d")
  const durationMatch = timeframe.match(/^(\d+(?:\.\d+)?)([hdm])$/)
  if (!durationMatch) {
    throw new Error(
      "Invalid timeframe format. Use format like '1h', '30m', '2d', '1.5h', or '0.5d'",
    )
  }

  const [, value, unit] = durationMatch
  const unitMap: Record<string, string> = {
    h: "hour",
    d: "day",
    m: "minute",
  }
  return {
    value: parseFloat(value),
    unit: unitMap[unit] as "minute" | "hour" | "day",
    input: timeframe,
    duration: `${value} ${unitMap[unit]}`,
    durationInMinutes: parseFloat(value) * (unit === "h" ? 60 : unit === "d" ? 24 * 60 : 1),
  }
}

export const formatMinutesToTimeframeString = (minutes: number): string => {
  if (minutes === 0) {
    return ""
  }
  const hours = minutes / 60
  // Use toFixed to handle floating point inaccuracies and format to at most 2 decimal places
  const formattedHours = parseFloat(hours.toFixed(2))
  return `${formattedHours}h`
}

export const validateTimeframe = (timeframe: string) => {
  try {
    const timeframeData = parseTimeframe(timeframe)
    return timeframeData ? null : "Failed to parse timeframe."
  } catch (err) {
    return (err as Error)?.message || "Failed to parse timeframe."
  }
}
