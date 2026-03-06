import { v7 } from "uuid"

import db from "../common/db"
import { WorkEvent } from "../types"

import { parseTimeframe } from "../common/utils"

const WorkEventColumns = [
  "id",
  "timestamp",
  "timeframe",
  "project",
  "description",
  { userId: "user_id" },
  "meta",
  "created",
  "updated",
  "deleted",
]

// Helper function to build query with filters
const buildQuery = (term?: string, projects?: string[], minDate?: Date, maxDate?: Date) => {
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
    query = query.andWhere("timestamp", ">=", minDate)
  }
  if (maxDate) {
    query = query.andWhere("timestamp", "<=", maxDate)
  }

  return query
}

export async function fetchProjects({ userId }: { userId: string }) {
  const query = db("work_event")
    .where("user_id", userId)
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
  trackingOnly?: boolean
  userId?: string
}): Promise<{ data: WorkEvent[]; total: number }> {
  // Skip caching if search term is provided
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

export async function insert(data: WorkEvent) {
  const result = await db("work_event")
    .insert({
      id: data.id || v7(),
      timeframe: parseTimeframe(data.timeframe),
      timestamp: data.timestamp || new Date(Date.now()),
      project: data.project || "",
      description: data.description || "",
      meta: {
        channel_id: data.channel?.id || null,
        channel_name: data.channel?.name || null,
        team_id: data.team?.id || null,
        team_name: data.team?.name || null,
        user_id: data.user?.id || null,
        user_name: data.user?.name || null,
      },
      user_id: data.user?.id || "",
    })
    .returning(["id", "timeframe", "project", "description", "timestamp"])
  return result && result?.[0]
}

export async function remove(id: string) {
  return db("work_event").where({ id }).update({ deleted: true, updated: new Date() })
}

export async function update(id: string, data: Partial<WorkEvent>) {
  const result = await db("work_event")
    .where({ id })
    .update({
      ...data,
      timeframe: data.timeframe ? parseTimeframe(data.timeframe as unknown as string) : null,
      updated: new Date(),
    })
    .returning(["id", "timeframe", "project", "description", "timestamp"])
  return result && result?.[0]
}
