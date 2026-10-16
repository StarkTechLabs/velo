import { busybeeRowToEvent } from "./busybee"
import { csvToEvents, parseCsv } from "./csv"
import { eventsToCsv } from "../common/group"
import { WorkEvent } from "../types"

describe("parseCsv", () => {
  it("handles quotes, embedded commas/newlines, CRLF and a missing final newline", () => {
    expect(parseCsv('a,b\r\n"x, ""y""","line1\nline2"\r\nlast,row')).toEqual([
      ["a", "b"],
      ['x, "y"', "line1\nline2"],
      ["last", "row"],
    ])
  })

  it("keeps empty fields, skips blank lines, and rejects unterminated quotes", () => {
    expect(parseCsv("a,,c\n\nd,e,\n")).toEqual([
      ["a", "", "c"],
      ["d", "e", ""],
    ])
    expect(() => parseCsv('a,"b')).toThrow("unterminated")
  })
})

describe("csvToEvents", () => {
  it("reads the velo/chrono export format", () => {
    const { format, events, errors } = csvToEvents(
      "date,project,description,hours\n2026-01-10,alpha,Fix bug,1.50\n2026-01-11,beta,,0.25\n",
    )
    expect(format).toBe("velo")
    expect(errors).toEqual([])
    expect(events.map((e) => [e.project, e.description, e.timeframe])).toEqual([
      ["alpha", "Fix bug", "90m"],
      ["beta", "", "15m"],
    ])
    // noon local time keeps the day stable
    expect(new Date(events[0].timestamp as string).getHours()).toBe(12)
  })

  it("reads the legacy Busywork log format (minutes)", () => {
    const { format, events } = csvToEvents(
      "team,channel,timestamp,username,userid,project,duration,description\n" +
        "t,c,2025-03-01T15:00:00Z,me,u1, busybee ,45,Did things\n",
    )
    expect(format).toBe("busywork")
    expect(events[0]).toMatchObject({
      timestamp: "2025-03-01T15:00:00.000Z",
      project: "busybee",
      timeframe: "45m",
      description: "Did things",
    })
  })

  it("round-trips the export format", () => {
    const event = (over: Partial<WorkEvent>): WorkEvent => ({
      id: "x",
      timestamp: new Date(2026, 0, 10, 9).toISOString(),
      timeframe: "1h",
      minutes: 60,
      project: "a",
      description: 'say "hi", ok',
      created: "",
      updated: "",
      ...over,
    })
    const { events } = csvToEvents(eventsToCsv([event({}), event({ minutes: 30 })]))
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ project: "a", description: 'say "hi", ok', timeframe: "90m" })
  })

  it("derives stable, unique ids from content", () => {
    const csv = "date,project,description,hours\n2026-01-10,a,x,1\n2026-01-10,a,x,1\n"
    const first = csvToEvents(csv).events.map((e) => e.id)
    expect(new Set(first).size).toBe(2)
    expect(csvToEvents(csv).events.map((e) => e.id)).toEqual(first)
  })

  it("reports bad rows with their line number and keeps the good ones", () => {
    const { events, errors } = csvToEvents(
      "date,project,description,hours\n2026-01-10,a,x,1\nnot-a-date,a,x,1\n2026-01-10,a,x,0\n2026-01-10,a,x,abc\n",
    )
    expect(events).toHaveLength(1)
    expect(errors).toEqual([
      { line: 3, error: 'Invalid date "not-a-date"' },
      { line: 4, error: 'Invalid duration "0"' },
      { line: 5, error: 'Invalid duration "abc"' },
    ])
  })

  it("strips a BOM and rejects unknown headers and empty input", () => {
    expect(csvToEvents("﻿date,project,description,hours\n").format).toBe("velo")
    expect(() => csvToEvents("a,b\n1,2")).toThrow("Unrecognized CSV header")
    expect(() => csvToEvents("")).toThrow("empty")
  })
})

describe("busybeeRowToEvent", () => {
  const base = {
    id: "id-1",
    timestamp: new Date("2025-05-05T10:00:00Z"),
    project: "p",
    description: "d",
  }

  it("uses the jsonb input when valid, as object or string", () => {
    expect(
      busybeeRowToEvent({ ...base, timeframe: { input: "1.5h", durationInMinutes: 90 } }),
    ).toEqual({
      id: "id-1",
      timestamp: "2025-05-05T10:00:00.000Z",
      timeframe: "1.5h",
      project: "p",
      description: "d",
    })
    expect(busybeeRowToEvent({ ...base, timeframe: '{"input":"2d"}' }).timeframe).toBe("2d")
    expect(busybeeRowToEvent({ ...base, timeframe: "30m" }).timeframe).toBe("30m")
  })

  it("falls back to durationInMinutes and null-safes text columns", () => {
    const event = busybeeRowToEvent({
      ...base,
      timestamp: "2025-05-05T10:00:00Z",
      project: null,
      description: null,
      timeframe: { input: "garbage", durationInMinutes: 45 },
    })
    expect(event).toMatchObject({ timeframe: "45m", project: "", description: "" })
  })

  it("throws for an unreadable timeframe", () => {
    expect(() => busybeeRowToEvent({ ...base, timeframe: null })).toThrow("Unreadable timeframe")
  })
})
