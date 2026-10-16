import { GroupedEvent, WorkEvent } from "../types"
import { localDateKey } from "./dates"

/** Groups events that share a local date, project and description. Newest group first. */
export const groupEvents = (events: WorkEvent[]): GroupedEvent[] => {
  const groups = new Map<string, GroupedEvent>()
  for (const event of events) {
    const date = localDateKey(event.timestamp)
    const key = JSON.stringify([date, event.project, event.description])
    let group = groups.get(key)
    if (!group) {
      group = {
        date,
        project: event.project,
        description: event.description,
        totalMinutes: 0,
        eventCount: 0,
        events: [],
      }
      groups.set(key, group)
    }
    group.totalMinutes += event.minutes
    group.eventCount += 1
    group.events.push(event)
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
}

const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

/** CSV with columns date, project, description, hours (grouped, oldest first). */
export const eventsToCsv = (events: WorkEvent[]): string => {
  const rows = groupEvents(events)
    .reverse()
    .map((g) =>
      [g.date, g.project, g.description, (g.totalMinutes / 60).toFixed(2)].map(csvCell).join(","),
    )
  return ["date,project,description,hours", ...rows].join("\n") + "\n"
}
