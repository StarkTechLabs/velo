import { getDb } from "@/common/db"
import { EventFilter, DayStat, ProjectStat, Stats } from "@/types"

import { filteredQuery } from "./workEvent"

export async function getStats(filter: EventFilter = {}): Promise<Stats> {
  type ProjectRow = { project: string; minutes: number; eventCount: number }
  type DayRow = { date: string; project: string; minutes: number }

  const byProjectRows: ProjectRow[] = await filteredQuery(filter)
    .select("project")
    .sum({ minutes: "minutes" })
    .count({ eventCount: "id" })
    .groupBy("project")
    .orderBy([
      { column: "minutes", order: "desc" },
      { column: "project", order: "asc" },
    ])

  const byProject: ProjectStat[] = byProjectRows.map((r) => ({
    project: r.project,
    minutes: Number(r.minutes),
    eventCount: Number(r.eventCount),
  }))

  const dayRows: DayRow[] = await filteredQuery(filter)
    .select(getDb().raw("date(timestamp, 'localtime') as date"), "project")
    .sum({ minutes: "minutes" })
    .groupBy("date", "project")
    .orderBy("date", "asc")

  const days = new Map<string, DayStat>()
  for (const row of dayRows) {
    const day: DayStat = days.get(row.date) ?? { date: row.date, minutes: 0, byProject: {} }
    day.byProject[row.project] = Number(row.minutes)
    day.minutes += Number(row.minutes)
    days.set(row.date, day)
  }

  return {
    totalMinutes: byProject.reduce((sum, p) => sum + p.minutes, 0),
    eventCount: byProject.reduce((sum, p) => sum + p.eventCount, 0),
    byProject,
    byDay: [...days.values()],
  }
}
