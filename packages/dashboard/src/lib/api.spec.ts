import {
  ApiError,
  deleteEvent,
  errorText,
  fetchCsv,
  fetchEvents,
  fetchProjects,
  saveEvent,
  setApiBase,
} from "./api"

const respond = (body: unknown, init: { status?: number; json?: boolean } = {}) =>
  Promise.resolve({
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: "Status text",
    json: () =>
      init.json === false ? Promise.reject(new Error("no json")) : Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as Response)

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setApiBase("")
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe("fetchEvents", () => {
  it("sends the filters under the API's parameter names", async () => {
    fetchMock.mockReturnValue(respond({ data: [], total: 0, page: 1, pageSize: 500 }))
    await fetchEvents({
      term: "bug",
      projects: ["a", "b"],
      minDate: new Date("2026-01-01T00:00:00.000Z"),
      maxDate: new Date("2026-01-31T23:59:59.999Z"),
      page: 2,
      pageSize: 500,
    })
    const url = new URL(fetchMock.mock.calls[0][0], "http://x")
    expect(url.pathname).toBe("/api/events")
    expect(url.searchParams.get("term")).toBe("bug")
    expect(url.searchParams.getAll("project")).toEqual(["a", "b"])
    expect(url.searchParams.get("min_date")).toBe("2026-01-01T00:00:00.000Z")
    expect(url.searchParams.get("max_date")).toBe("2026-01-31T23:59:59.999Z")
    expect(url.searchParams.get("page")).toBe("2")
    expect(url.searchParams.get("pageSize")).toBe("500")
  })

  it("omits empty filters", async () => {
    fetchMock.mockReturnValue(respond({ data: [] }))
    await fetchEvents({ term: "", projects: [] })
    expect(fetchMock.mock.calls[0][0]).toBe("/api/events?")
  })

  it("prefixes the configured API base, ignoring trailing slashes", async () => {
    setApiBase("http://127.0.0.1:4317//")
    fetchMock.mockReturnValue(respond(["a"]))
    expect(await fetchProjects()).toEqual(["a"])
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:4317/api/projects")
  })
})

describe("errors", () => {
  it("uses the API's error message and status", async () => {
    fetchMock.mockReturnValue(respond({ error: "timeframe: bad" }, { status: 400 }))
    const error = await saveEvent(undefined, {
      timestamp: new Date(),
      project: "p",
      description: "",
      timeframe: "x",
    }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: "timeframe: bad", status: 400 })
  })

  it("falls back to the status text for non-JSON error bodies", async () => {
    fetchMock.mockReturnValue(respond("<html>", { status: 502, json: false }))
    await expect(fetchProjects()).rejects.toMatchObject({ message: "Status text", status: 502 })
  })

  it("reports an unreachable API with status 0 and how to start it", async () => {
    setApiBase("http://127.0.0.1:4317")
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))
    const error = await fetchEvents({}).catch((e) => e)
    expect(error).toMatchObject({ status: 0 })
    expect(error.message).toBe(
      "Can't reach the velo API at http://127.0.0.1:4317. Start it with: velo api start",
    )
    await expect(fetchCsv({})).rejects.toMatchObject({ status: 0 })
  })

  it("errorText handles non-Error values", () => {
    expect(errorText(new Error("boom"))).toBe("boom")
    expect(errorText("plain")).toBe("plain")
  })
})

describe("writes", () => {
  const values = {
    timestamp: new Date("2026-01-10T12:00:00.000Z"),
    project: "p",
    description: "d",
    timeframe: "1h",
  }

  it("POSTs a new event and PUTs an existing one, as JSON with an ISO timestamp", async () => {
    fetchMock.mockReturnValue(respond({ id: "1" }))
    await saveEvent(undefined, values)
    await saveEvent("abc", values)
    const [create, update] = fetchMock.mock.calls
    expect([create[0], create[1].method]).toEqual(["/api/events", "POST"])
    expect([update[0], update[1].method]).toEqual(["/api/events/abc", "PUT"])
    expect(create[1].headers).toEqual({ "Content-Type": "application/json" })
    expect(JSON.parse(create[1].body)).toEqual({ ...values, timestamp: "2026-01-10T12:00:00.000Z" })
  })

  it("DELETEs and tolerates the 204 with no body", async () => {
    fetchMock.mockReturnValue(respond(undefined, { status: 204 }))
    await expect(deleteEvent("abc")).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith("/api/events/abc", { method: "DELETE" })
  })
})

describe("fetchCsv", () => {
  it("requests the export with the filter but without paging", async () => {
    fetchMock.mockReturnValue(respond("date,project\n"))
    expect(await fetchCsv({ projects: ["a"], page: 3, pageSize: 500 })).toBe("date,project\n")
    expect(fetchMock.mock.calls[0][0]).toBe("/api/export.csv?project=a")
  })

  it("throws on a failed export", async () => {
    fetchMock.mockReturnValue(respond("", { status: 500 }))
    await expect(fetchCsv({})).rejects.toMatchObject({ status: 500 })
  })
})
