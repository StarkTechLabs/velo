import { CreateEvent, timeframeSchema } from "../types"

/** A row of the busybee-x Postgres `work_event` table. */
export type BusybeeRow = {
  id: string
  timestamp: Date | string
  timeframe: string | { input?: string; durationInMinutes?: number } | null
  project: string | null
  description: string | null
}

/** Maps a busybee-x row to an event, keeping its id so re-imports are idempotent. */
export const busybeeRowToEvent = (row: BusybeeRow): CreateEvent => {
  // `timeframe` is jsonb in Postgres: {input: "1h", durationInMinutes: 60, ...}
  let tf = row.timeframe
  if (typeof tf === "string" && tf.trim().startsWith("{")) tf = JSON.parse(tf)

  let timeframe: string | undefined
  if (typeof tf === "string") timeframe = tf
  else if (tf?.input && timeframeSchema.safeParse(tf.input).success) timeframe = tf.input
  else if (tf?.durationInMinutes) timeframe = `${tf.durationInMinutes}m`
  if (!timeframe) throw new Error("Unreadable timeframe")

  return {
    id: row.id,
    timestamp: new Date(row.timestamp).toISOString(),
    timeframe,
    project: row.project ?? "",
    description: row.description ?? "",
  }
}
