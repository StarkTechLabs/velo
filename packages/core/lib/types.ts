import { z } from "zod"

import { parseTimeframe } from "./common/utils"

export type TimeframeData = {
  value: number
  input: string
  unit: "minute" | "hour" | "day"
  duration: string
  durationInMinutes: number
}

// <number><unit> where unit is m(inutes), h(ours) or d(ays), e.g. 30m, 1.5h, 2d
export const timeframeSchema = z
  .string()
  .regex(/^(\d+(?:\.\d+)?)([hdm])$/, {
    message:
      "Invalid timeframe format. Expected format: <number><unit> where unit is m(minute), h(hour), or d(day)",
  })
  .refine((value) => parseTimeframe(value).durationInMinutes > 0, {
    message: "Timeframe must be greater than zero",
  })

// Accepts any date string and normalizes it to a UTC ISO string
const timestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: "Invalid timestamp" })
  .transform((value) => new Date(value).toISOString())

const eventFields = {
  project: z.string().trim().min(1, "Project is required"),
  timeframe: timeframeSchema,
  description: z.string(),
  timestamp: timestampSchema,
}

export const createEventSchema = z.object({
  id: z.string().min(1).optional(),
  project: eventFields.project,
  timeframe: eventFields.timeframe,
  description: eventFields.description.default(""),
  timestamp: eventFields.timestamp.optional(),
})

export const updateEventSchema = z.object(eventFields).partial()

export const eventFilterSchema = z.object({
  term: z.string().trim().optional(),
  projects: z.array(z.string()).optional(),
  minDate: z.coerce.date().optional(),
  maxDate: z.coerce.date().optional(),
})

export const listEventsSchema = eventFilterSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
})

export type CreateEvent = z.input<typeof createEventSchema>
export type UpdateEvent = z.input<typeof updateEventSchema>
export type EventFilter = z.input<typeof eventFilterSchema>
export type ListEventsQuery = z.input<typeof listEventsSchema>

export type WorkEvent = {
  id: string
  /** UTC ISO timestamp of when the work happened */
  timestamp: string
  /** Original input, e.g. "1.5h" */
  timeframe: string
  minutes: number
  project: string
  description: string
  created: string
  updated: string
}

export type Page<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export type GroupedEvent = {
  /** Local date, YYYY-MM-DD */
  date: string
  project: string
  description: string
  totalMinutes: number
  eventCount: number
  events: WorkEvent[]
}

export type ProjectStat = { project: string; minutes: number; eventCount: number }

export type DayStat = {
  /** Local date, YYYY-MM-DD */
  date: string
  minutes: number
  byProject: Record<string, number>
}

export type Stats = {
  totalMinutes: number
  eventCount: number
  byProject: ProjectStat[]
  byDay: DayStat[]
}
