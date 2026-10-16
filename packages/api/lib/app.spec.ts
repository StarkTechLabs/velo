import { closeDb, getDb } from "@starktech/core"
import request from "supertest"

import { createApp } from "./app"
import { DASHBOARD_ORIGIN, clearEvents, setupTestDb, testApp } from "./testing/app"

const app = testApp()

beforeAll(setupTestDb)
afterAll(closeDb)
beforeEach(clearEvents)

const base = {
  project: "alpha",
  timeframe: "1h",
  description: "work",
  timestamp: "2026-01-10T12:00:00.000Z",
}

const create = async (over = {}) =>
  (
    await request(app)
      .post("/api/events")
      .send({ ...base, ...over })
  ).body

describe("health", () => {
  it("reports identity for detection by the CLI", async () => {
    const res = await request(app).get("/api/health")
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      name: "velo-api",
      version: "1.2.3",
      pid: process.pid,
      databaseFilePath: "/tmp/test.sqlite",
    })
    expect(res.headers["cache-control"]).toBe("no-store")
    expect(res.headers["x-powered-by"]).toBeUndefined()
  })
})

describe("POST /api/events", () => {
  it("creates an event", async () => {
    const res = await request(app).post("/api/events").send(base)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ ...base, minutes: 60 })
    expect(res.headers.location).toBe(`/api/events/${res.body.id}`)
  })

  it("returns field-level validation errors", async () => {
    const res = await request(app).post("/api/events").send({ project: " ", timeframe: "abc" })
    expect(res.status).toBe(400)
    expect(res.body.issues.map((i: { path: string }) => i.path).sort()).toEqual([
      "project",
      "timeframe",
    ])
    expect(res.body.error).toContain("timeframe: Invalid timeframe format")
  })

  it("rejects non-JSON content types and malformed JSON", async () => {
    const text = await request(app)
      .post("/api/events")
      .type("text/plain")
      .send(JSON.stringify(base))
    expect(text.status).toBe(415)
    const form = await request(app).post("/api/events").type("form").send(base)
    expect(form.status).toBe(415)
    const bad = await request(app).post("/api/events").type("json").send("{nope")
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe("Request body is not valid JSON")
    expect((await request(app).get("/api/events")).body.total).toBe(0)
  })
})

describe("GET /api/events", () => {
  beforeEach(async () => {
    await create({ project: "alpha", description: "wrote tests" })
    await create({
      project: "beta",
      description: "fixed bug",
      timestamp: "2026-02-10T12:00:00.000Z",
    })
    await create({ project: "alpha", description: "review", timestamp: "2026-03-10T12:00:00.000Z" })
  })

  it("lists newest first with paging metadata", async () => {
    const res = await request(app).get("/api/events")
    expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 20 })
    expect(res.body.data.map((e: { description: string }) => e.description)).toEqual([
      "review",
      "fixed bug",
      "wrote tests",
    ])
  })

  it("filters by term, repeated project, and dates (the busybee-x query names)", async () => {
    const get = async (qs: string) => (await request(app).get(`/api/events?${qs}`)).body.total
    expect(await get("term=BUG")).toBe(1)
    expect(await get("project=alpha")).toBe(2)
    expect(await get("project=alpha&project=beta")).toBe(3)
    expect(await get("min_date=2026-02-01&max_date=2026-02-28")).toBe(1)
    expect(await get("min_date=2026-02-10T12:00:00.000Z")).toBe(2)
    expect(await get("term=&page=1&pageSize=500")).toBe(3)
  })

  it("paginates", async () => {
    const res = await request(app).get("/api/events?page=2&pageSize=2")
    expect(res.body.data).toHaveLength(1)
    expect(res.body).toMatchObject({ total: 3, page: 2, pageSize: 2 })
  })

  it("returns 400 for bad dates and paging", async () => {
    const date = await request(app).get("/api/events?min_date=yesterdayish")
    expect(date.status).toBe(400)
    expect(date.body.error).toBe('min_date: invalid date "yesterdayish"')
    expect((await request(app).get("/api/events?pageSize=0")).status).toBe(400)
    expect((await request(app).get("/api/events?page=abc")).status).toBe(400)
  })
})

describe("/api/events/:id", () => {
  it("gets, updates and deletes", async () => {
    const { id } = await create()

    expect((await request(app).get(`/api/events/${id}`)).body).toMatchObject({
      id,
      project: "alpha",
    })

    const put = await request(app)
      .put(`/api/events/${id}`)
      .send({ timeframe: "2h", description: "changed" })
    expect(put.status).toBe(200)
    expect(put.body).toMatchObject({ id, minutes: 120, description: "changed", project: "alpha" })

    expect((await request(app).delete(`/api/events/${id}`)).status).toBe(204)
    expect((await request(app).get(`/api/events/${id}`)).status).toBe(404)
    expect((await request(app).delete(`/api/events/${id}`)).status).toBe(404)
    expect((await request(app).put(`/api/events/${id}`).send({ project: "x" })).status).toBe(404)
  })

  it("validates updates", async () => {
    const { id } = await create()
    const bad = await request(app).put(`/api/events/${id}`).send({ timeframe: "nope" })
    expect(bad.status).toBe(400)
    const empty = await request(app).put(`/api/events/${id}`).send({})
    expect(empty.status).toBe(400)
    expect(empty.body.error).toBe("No fields to update")
    expect((await request(app).get(`/api/events/${id}`)).body.timeframe).toBe("1h")
  })

  it("404s for an unknown id", async () => {
    const res = await request(app).get("/api/events/missing")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Event not found" })
  })
})

describe("projects, stats, export", () => {
  beforeEach(async () => {
    await create({ project: "beta" })
    await create({ project: "Alpha", timeframe: "30m" })
  })

  it("lists projects", async () => {
    expect((await request(app).get("/api/projects")).body).toEqual(["Alpha", "beta"])
  })

  it("returns stats, honouring filters", async () => {
    const all = await request(app).get("/api/stats")
    expect(all.body).toMatchObject({ totalMinutes: 90, eventCount: 2 })
    expect(all.body.byProject.map((p: { project: string }) => p.project)).toEqual(["beta", "Alpha"])
    expect(all.body.byDay).toHaveLength(1)
    expect((await request(app).get("/api/stats?project=Alpha")).body.totalMinutes).toBe(30)
  })

  it("exports CSV as a download", async () => {
    const res = await request(app).get("/api/export.csv")
    expect(res.status).toBe(200)
    expect(res.headers["content-type"]).toContain("text/csv")
    expect(res.headers["content-disposition"]).toMatch(
      /^attachment; filename="velo-export-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
    expect(res.text).toContain("date,project,description,hours")
    expect(res.text).toContain("2026-01-10,beta,work,1.00")
  })
})

describe("unknown routes", () => {
  it("returns JSON 404s", async () => {
    const res = await request(app).get("/api/nope")
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: "Not found" })
  })
})

describe("browser protections", () => {
  it("allows no-Origin requests and the dashboard origin, with CORS headers only for the latter", async () => {
    const cli = await request(app).get("/api/health")
    expect(cli.headers["access-control-allow-origin"]).toBeUndefined()

    const dash = await request(app).get("/api/health").set("Origin", DASHBOARD_ORIGIN)
    expect(dash.status).toBe(200)
    expect(dash.headers["access-control-allow-origin"]).toBe(DASHBOARD_ORIGIN)
    expect(dash.headers.vary).toContain("Origin")
  })

  it("answers preflights for the dashboard", async () => {
    const res = await request(app)
      .options("/api/events")
      .set("Origin", DASHBOARD_ORIGIN)
      .set("Access-Control-Request-Method", "DELETE")
    expect(res.status).toBe(204)
    expect(res.headers["access-control-allow-methods"]).toContain("DELETE")
    expect(res.headers["access-control-allow-headers"]).toBe("Content-Type")
  })

  it("refuses other origins before touching data, even for simple requests", async () => {
    const evil = "https://evil.example"
    const res = await request(app).post("/api/events").set("Origin", evil).type("json").send(base)
    expect(res.status).toBe(403)
    expect(res.headers["access-control-allow-origin"]).toBeUndefined()
    expect((await request(app).options("/api/events").set("Origin", evil)).status).toBe(403)
    expect((await request(app).get("/api/events")).body.total).toBe(0)
  })

  it("rejects non-loopback Host headers (DNS rebinding) but accepts loopback names", async () => {
    expect((await request(app).get("/api/health").set("Host", "evil.example:4317")).status).toBe(
      403,
    )
    expect((await request(app).get("/api/health").set("Host", "localhost:4317")).status).toBe(200)
    expect((await request(app).get("/api/health").set("Host", "127.0.0.1:9")).status).toBe(200)
    expect((await request(app).get("/api/health").set("Host", "[::1]:4317")).status).toBe(200)
  })

  it("skips the Host check when explicitly bound to a non-loopback address", async () => {
    const open = createApp({
      version: "x",
      databaseFilePath: "",
      allowedOrigins: [],
      checkHost: false,
      log: () => {},
    })
    expect((await request(open).get("/api/health").set("Host", "myhost.lan:4317")).status).toBe(200)
  })
})

describe("server errors", () => {
  it("logs the cause but hides internals from 500 responses", async () => {
    const lines: string[] = []
    const failing = createApp({
      version: "x",
      databaseFilePath: "",
      allowedOrigins: [],
      log: (l) => lines.push(l),
    })
    // break the db layer: the table the queries need no longer exists
    await getDb().schema.renameTable("work_event", "work_event_x")
    try {
      const res = await request(failing).get("/api/projects")
      expect(res.status).toBe(500)
      expect(res.body).toEqual({ error: "Internal server error" })
      expect(lines.join("\n")).toContain("work_event")
    } finally {
      await getDb().schema.renameTable("work_event_x", "work_event")
    }
  })
})
