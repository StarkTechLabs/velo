import { Knex } from "knex"

import { getDb } from "@/common/db"
import { parseTimeframe } from "@/common/utils"
import { uuidv7 } from "@/common/uuid"
import {
  CreateEvent,
  EventFilter,
  ListEventsQuery,
  Page,
  UpdateEvent,
  WorkEvent,
  createEventSchema,
  eventFilterSchema,
  listEventsSchema,
  updateEventSchema,
} from "@/types"

const TABLE = "work_event"
const COLUMNS = [
  "id",
  "timestamp",
  "timeframe",
  "minutes",
  "project",
  "description",
  "created",
  "updated",
]

/** Non-deleted events matching the filter. */
export const filteredQuery = (filter: EventFilter = {}): Knex.QueryBuilder => {
  const { term, projects, minDate, maxDate } = eventFilterSchema.parse(filter)
  const query = getDb()(TABLE).where("deleted", false)

  if (term) {
    const like = `%${term.toLowerCase()}%`
    query.andWhere((q) => {
      q.whereRaw("lower(project) like ?", [like]).orWhereRaw("lower(description) like ?", [like])
    })
  }
  if (projects?.length) query.whereIn("project", projects)
  if (minDate) query.andWhere("timestamp", ">=", minDate.toISOString())
  if (maxDate) query.andWhere("timestamp", "<=", maxDate.toISOString())
  return query
}

export async function listEvents(input: ListEventsQuery = {}): Promise<Page<WorkEvent>> {
  const { page, pageSize, ...filter } = listEventsSchema.parse(input)

  const countRow = await filteredQuery(filter).count({ count: "id" }).first()
  const data = await filteredQuery(filter)
    .select(COLUMNS)
    .orderBy([
      { column: "timestamp", order: "desc" },
      { column: "id", order: "desc" },
    ])
    .offset((page - 1) * pageSize)
    .limit(pageSize)

  return { data, total: Number(countRow?.count ?? 0), page, pageSize }
}

export async function getEvent(id: string): Promise<WorkEvent | null> {
  const row = await getDb()(TABLE).select(COLUMNS).where({ id, deleted: false }).first()
  return row ?? null
}

export async function listProjects(): Promise<string[]> {
  const rows = await getDb()(TABLE)
    .where("deleted", false)
    .distinct("project")
    .orderByRaw("project collate nocase asc")
  return rows.map((r) => r.project)
}

export async function createEvent(input: CreateEvent): Promise<WorkEvent> {
  const data = createEventSchema.parse(input)
  const now = new Date().toISOString()
  const id = data.id ?? uuidv7()
  await getDb()(TABLE).insert({
    id,
    timestamp: data.timestamp ?? now,
    timeframe: data.timeframe,
    minutes: parseTimeframe(data.timeframe).durationInMinutes,
    project: data.project,
    description: data.description,
    created: now,
    updated: now,
  })
  return (await getEvent(id)) as WorkEvent
}

/** Returns the updated event, or null when it doesn't exist. */
export async function updateEvent(id: string, input: UpdateEvent): Promise<WorkEvent | null> {
  const data = updateEventSchema.parse(input)
  const payload: Record<string, unknown> = { ...data, updated: new Date().toISOString() }
  if (data.timeframe !== undefined) {
    payload.minutes = parseTimeframe(data.timeframe).durationInMinutes
  }
  const changed = await getDb()(TABLE).where({ id, deleted: false }).update(payload)
  return changed ? getEvent(id) : null
}

/** Soft delete. Returns false when the event doesn't exist. */
export async function deleteEvent(id: string): Promise<boolean> {
  const changed = await getDb()(TABLE)
    .where({ id, deleted: false })
    .update({ deleted: true, updated: new Date().toISOString() })
  return changed > 0
}
