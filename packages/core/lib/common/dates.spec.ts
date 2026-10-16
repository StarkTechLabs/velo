import { endOfDay, localDateKey, startOfDay } from "./dates"

describe("date helpers", () => {
  it("localDateKey formats the local calendar date", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
  })

  it("startOfDay and endOfDay bound the same local day", () => {
    const noon = new Date(2026, 5, 15, 12, 30)
    const start = startOfDay(noon)
    const end = endOfDay(noon)
    expect([start.getHours(), start.getMinutes(), start.getMilliseconds()]).toEqual([0, 0, 0])
    expect([end.getHours(), end.getMinutes(), end.getMilliseconds()]).toEqual([23, 59, 999])
    expect(localDateKey(start)).toBe(localDateKey(end))
    expect(noon.getHours()).toBe(12) // input not mutated
  })
})
