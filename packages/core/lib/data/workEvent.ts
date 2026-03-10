import { v7 } from "uuid"

import { getDb } from "@/common/db"
import { WorkEvent } from "@/types"

const WorkEventColumns = [
  "id",
  "timestamp",
  "timeframe",
  "project",
  "description",
  { userId: "user_id" },
  "channel",
  "meta",
  "created",
  "updated",
  "deleted",
]

// Helper function to build query with filters
const buildQuery = (term?: string, projects?: string[], minDate?: Date, maxDate?: Date) => {
  const db = getDb()
  let query = db("work_event").select(WorkEventColumns).where("work_event.deleted", false)

  if (term) {
    query = query.andWhere(function () {
      this.where(
        db.raw('lower("work_event"."project")'),
        "like",
        `%${term.toLowerCase().trim()}%`,
      ).orWhere(
        db.raw('lower("work_event"."description")'),
        "like",
        `%${term.toLowerCase().trim()}%`,
      )
    })
  }
  if (projects && projects.length > 0) {
    query = query.whereIn("project", projects)
  }
  if (minDate) {
    query = query.andWhere("timestamp", ">=", minDate.toISOString())
  }
  if (maxDate) {
    query = query.andWhere("timestamp", "<=", maxDate.toISOString())
  }

  return query
}

export async function fetchProjects({ userId }: { userId: string }) {
  const db = getDb()
  const query = db("work_event")
    .where("user_id", userId)
    .where("deleted", false)
    .select(["project"])
    .groupBy("project")
    .orderBy("project", "asc")

  const results = await query
  return results
}

export async function fetchPaginated({
  term = "",
  projects,
  minDate,
  maxDate,
  page = 1,
  pageSize = 20,
  userId = "",
}: {
  term?: string
  projects?: string[]
  minDate?: Date
  maxDate?: Date
  page?: number
  pageSize?: number
  userId?: string
}): Promise<{ data: WorkEvent[]; total: number }> {
  const query = buildQuery(term, projects, minDate, maxDate)
  query.andWhere("user_id", userId)

  // Get total count
  const countQuery = query.clone().clearSelect().count({ count: "id" }).first()
  const countResult = await countQuery
  const total = countResult?.count ? Number(countResult.count) : 0

  // Pagination
  const offset = (page - 1) * pageSize
  const rows = await query.orderBy("timestamp", "desc").offset(offset).limit(pageSize)

  return { data: rows, total }
}

export async function insert(data: WorkEvent): Promise<string> {
  const db = getDb()
  const id = data.id || v7()
  await db("work_event").insert({
    id,
    timeframe: data.timeframe,
    timestamp: data.timestamp || new Date().toISOString(),
    project: data.project || "",
    description: data.description || "",
    channel: data.channel || null,
    user_id: data.userId || null,
    meta: JSON.stringify({}),
  })
  return id
}

export async function remove(id: string) {
  const db = getDb()
  return db("work_event").where({ id }).update({ deleted: true, updated: new Date().toISOString() })
}

export async function update(id: string, data: Partial<WorkEvent>): Promise<string> {
  const db = getDb()
  const payload: Record<string, unknown> = { updated: new Date().toISOString() }
  if (data.timeframe !== undefined) payload.timeframe = data.timeframe
  if (data.project !== undefined) payload.project = data.project
  if (data.description !== undefined) payload.description = data.description
  if (data.timestamp !== undefined) payload.timestamp = data.timestamp
  if (data.userId !== undefined) payload.user_id = data.userId
  if (data.channel !== undefined) payload.channel = data.channel
  await db("work_event").where({ id }).update(payload)
  return id
}
