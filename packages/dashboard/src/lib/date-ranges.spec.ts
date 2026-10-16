import { DATE_OPTIONS, getDateRangeFromValue } from "./date-ranges"

const ymd = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()]
const hms = (d: Date) => [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]

// Wednesday 2026-01-14 15:30 local
const wednesday = new Date(2026, 0, 14, 15, 30)

const range = (value: string, now = wednesday) => {
  const r = getDateRangeFromValue(value, now)
  if (!r) throw new Error(`no range for ${value}`)
  return { from: ymd(r.minDate), to: ymd(r.maxDate), r }
}

describe("getDateRangeFromValue", () => {
  it("covers whole local days, midnight to 23:59:59.999", () => {
    const { r, from, to } = range("today")
    expect([from, to]).toEqual([
      [2026, 1, 14],
      [2026, 1, 14],
    ])
    expect(hms(r.minDate)).toEqual([0, 0, 0, 0])
    expect(hms(r.maxDate)).toEqual([23, 59, 59, 999])
    expect(range("yesterday").from).toEqual([2026, 1, 13])
  })

  it("uses Sunday-start weeks", () => {
    expect(range("this-week")).toMatchObject({ from: [2026, 1, 11], to: [2026, 1, 17] })
    expect(range("last-week")).toMatchObject({ from: [2026, 1, 4], to: [2026, 1, 10] })
    // on a Sunday the current week starts today and last week ended yesterday
    const sunday = new Date(2026, 0, 11, 9)
    expect(range("this-week", sunday)).toMatchObject({ from: [2026, 1, 11], to: [2026, 1, 17] })
    expect(range("last-week", sunday)).toMatchObject({ from: [2026, 1, 4], to: [2026, 1, 10] })
  })

  it("rolling windows include today", () => {
    expect(range("last-7-days")).toMatchObject({ from: [2026, 1, 8], to: [2026, 1, 14] })
    expect(range("last-14-days").from).toEqual([2026, 1, 1])
    expect(range("last-30-days").from).toEqual([2025, 12, 16])
  })

  it("counts 14-day pay periods from 2025-08-02", () => {
    // 2025-08-02 + 22*14 days = 2026-06-06?? no: check the period containing the date
    const first = range("current-pay-period", new Date(2025, 7, 2))
    expect(first).toMatchObject({ from: [2025, 8, 2], to: [2025, 8, 15] })
    expect(range("current-pay-period", new Date(2025, 7, 15, 23))).toMatchObject({
      from: [2025, 8, 2],
      to: [2025, 8, 15],
    })
    expect(range("current-pay-period", new Date(2025, 7, 16)).from).toEqual([2025, 8, 16])
    expect(range("last-pay-period", new Date(2025, 7, 16))).toMatchObject({
      from: [2025, 8, 2],
      to: [2025, 8, 15],
    })
    // periods before the anchor keep going backwards
    expect(range("current-pay-period", new Date(2025, 7, 1))).toMatchObject({
      from: [2025, 7, 19],
      to: [2025, 8, 1],
    })
  })

  it("stays on local calendar days across a DST change", () => {
    // US clocks spring forward 2026-03-08; a 24h-based calculation would land an hour off
    const afterDst = new Date(2026, 2, 10, 12)
    const { r, from } = range("last-7-days", afterDst)
    expect(from).toEqual([2026, 3, 4])
    expect(hms(r.minDate)).toEqual([0, 0, 0, 0])
  })

  it("returns null for unknown values, and every option resolves", () => {
    expect(getDateRangeFromValue("")).toBeNull()
    expect(getDateRangeFromValue("nope")).toBeNull()
    for (const { value } of DATE_OPTIONS) expect(getDateRangeFromValue(value)).not.toBeNull()
  })
})
