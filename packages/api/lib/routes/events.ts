import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
  updateEventSchema,
} from "@starktech/core"
import { Router } from "express"

import { HttpError } from "../errors"
import { filterFromQuery } from "../query"

export const eventsRouter = (): Router => {
  const router = Router()

  router.get("/", async (req, res) => {
    const result = await listEvents({
      ...filterFromQuery(req),
      page: req.query.page as string | undefined,
      pageSize: req.query.pageSize as string | undefined,
    })
    res.json(result)
  })

  router.post("/", async (req, res) => {
    const event = await createEvent(req.body ?? {})
    res.status(201).location(`/api/events/${event.id}`).json(event)
  })

  router.get("/:id", async (req, res) => {
    const event = await getEvent(req.params.id)
    if (!event) throw new HttpError(404, "Event not found")
    res.json(event)
  })

  router.put("/:id", async (req, res) => {
    const changes = updateEventSchema.parse(req.body ?? {})
    if (Object.keys(changes).length === 0) throw new HttpError(400, "No fields to update")
    const event = await updateEvent(req.params.id, changes)
    if (!event) throw new HttpError(404, "Event not found")
    res.json(event)
  })

  router.delete("/:id", async (req, res) => {
    if (!(await deleteEvent(req.params.id))) throw new HttpError(404, "Event not found")
    res.status(204).end()
  })

  return router
}
