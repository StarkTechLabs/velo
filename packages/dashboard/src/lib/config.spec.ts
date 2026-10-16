import { getApiBase, setApiBase } from "./api"
import { loadRuntimeConfig } from "./config"

afterEach(() => vi.unstubAllGlobals())

describe("loadRuntimeConfig", () => {
  it("points the API client at the apiUrl from /config.json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: async () => ({ apiUrl: "http://127.0.0.1:4317" }) }),
    )
    expect(await loadRuntimeConfig()).toEqual({ apiUrl: "http://127.0.0.1:4317" })
    expect(getApiBase()).toBe("http://127.0.0.1:4317")
  })

  it("uses the same origin when apiUrl is empty (dev proxy), absent, or the config is unreachable", async () => {
    setApiBase("http://stale")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({ apiUrl: "" }) }))
    await loadRuntimeConfig()
    expect(getApiBase()).toBe("")

    setApiBase("http://stale")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => ({}) }))
    await loadRuntimeConfig()
    expect(getApiBase()).toBe("")

    setApiBase("http://stale")
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    expect(await loadRuntimeConfig()).toEqual({ apiUrl: "" })
    expect(getApiBase()).toBe("")
  })
})
