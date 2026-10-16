import { eventsToCsv, getStats, listAllEvents, listProjects, localDateKey } from "@starktech/core"
import { Router } from "express"

import { filterFromQuery } from "../query"

export const reportsRouter = (): Router => {
  const router = Router()

  router.get("/projects", async (_req, res) => {
    res.json(await listProjects())
  })

  router.get("/stats", async (req, res) => {
    res.json(await getStats(filterFromQuery(req)))
  })

  router.get("/export.csv", async (req, res) => {
    const events = await listAllEvents(filterFromQuery(req))
    res
      .type("text/csv")
      .set(
        "Content-Disposition",
        `attachment; filename="velo-export-${localDateKey(new Date())}.csv"`,
      )
      .send(eventsToCsv(events))
  })

  return router
}
