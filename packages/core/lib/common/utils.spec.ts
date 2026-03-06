import { formatMinutesToTimeframeString, parseTimeframe } from "./utils"

describe("formatMinutesToTimeframeString", () => {
  it("should format minutes to hours correctly", () => {
    expect(formatMinutesToTimeframeString(90)).toBe("1.5h")
  })

  it("should handle whole hours correctly", () => {
    expect(formatMinutesToTimeframeString(120)).toBe("2h")
  })

  it("should handle less than an hour correctly", () => {
    expect(formatMinutesToTimeframeString(30)).toBe("0.5h")
  })

  it("should handle 0 minutes", () => {
    expect(formatMinutesToTimeframeString(0)).toBe("")
  })

  it("should handle floating point inaccuracies", () => {
    expect(formatMinutesToTimeframeString(45)).toBe("0.75h")
  })
})

describe("parseTimeframe", () => {
  it("should parse integer hours correctly", () => {
    const result = parseTimeframe("1h")
    expect(result.value).toBe(1)
    expect(result.unit).toBe("hour")
    expect(result.durationInMinutes).toBe(60)
  })

  it("should parse decimal hours correctly", () => {
    const result = parseTimeframe("1.5h")
    expect(result.value).toBe(1.5)
    expect(result.unit).toBe("hour")
    expect(result.durationInMinutes).toBe(90)
  })

  it("should parse decimal minutes correctly", () => {
    const result = parseTimeframe("30.5m")
    expect(result.value).toBe(30.5)
    expect(result.unit).toBe("minute")
    expect(result.durationInMinutes).toBe(30.5)
  })

  it("should parse decimal days correctly", () => {
    const result = parseTimeframe("0.5d")
    expect(result.value).toBe(0.5)
    expect(result.unit).toBe("day")
    expect(result.durationInMinutes).toBe(720)
  })

  it("should throw error for invalid format", () => {
    expect(() => parseTimeframe("invalid")).toThrow(
      "Invalid timeframe format. Use format like '1h', '30m', '2d', '1.5h', or '0.5d'",
    )
  })
})
