export interface DateRange {
  minDate: Date
  maxDate: Date
}

// Pay periods are two weeks long, counted from this local date.
export const PAY_PERIOD_START_DATE = new Date(2025, 7, 2) // August 2nd, 2025 (month is 0-indexed)
export const PAY_PERIOD_LENGTH_DAYS = 14

export const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "last-7-days", label: "Last 7 days" },
  { value: "last-14-days", label: "Last 14 days" },
  { value: "last-30-days", label: "Last 30 days" },
  { value: "current-pay-period", label: "Current pay period" },
  { value: "last-pay-period", label: "Last pay period" },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** Local midnight of `date` shifted by whole calendar days (safe across DST changes). */
const dayStart = (date: Date, offsetDays = 0): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays)

const dayEnd = (date: Date, offsetDays = 0): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays, 23, 59, 59, 999)

/** Whole calendar days from `from` to `to` (local dates, ignoring time and DST). */
const daysBetween = (from: Date, to: Date): number =>
  Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      DAY_MS,
  )

const payPeriodNumber = (date: Date): number =>
  Math.floor(daysBetween(PAY_PERIOD_START_DATE, date) / PAY_PERIOD_LENGTH_DAYS)

const payPeriodRange = (periodNumber: number): DateRange => {
  const start = dayStart(PAY_PERIOD_START_DATE, periodNumber * PAY_PERIOD_LENGTH_DAYS)
  return { minDate: start, maxDate: dayEnd(start, PAY_PERIOD_LENGTH_DAYS - 1) }
}

/** Converts a date-filter option value (see DATE_OPTIONS) to concrete bounds, or null. */
export const getDateRangeFromValue = (value: string, now: Date = new Date()): DateRange | null => {
  const sundayOffset = -now.getDay() // weeks start on Sunday

  switch (value) {
    case "today":
      return { minDate: dayStart(now), maxDate: dayEnd(now) }
    case "yesterday":
      return { minDate: dayStart(now, -1), maxDate: dayEnd(now, -1) }
    case "this-week":
      return { minDate: dayStart(now, sundayOffset), maxDate: dayEnd(now, sundayOffset + 6) }
    case "last-week":
      return { minDate: dayStart(now, sundayOffset - 7), maxDate: dayEnd(now, sundayOffset - 1) }
    case "last-7-days":
      return { minDate: dayStart(now, -6), maxDate: dayEnd(now) }
    case "last-14-days":
      return { minDate: dayStart(now, -13), maxDate: dayEnd(now) }
    case "last-30-days":
      return { minDate: dayStart(now, -29), maxDate: dayEnd(now) }
    case "current-pay-period":
      return payPeriodRange(payPeriodNumber(now))
    case "last-pay-period":
      return payPeriodRange(payPeriodNumber(now) - 1)
    default:
      return null
  }
}
