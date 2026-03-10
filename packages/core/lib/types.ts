import { z } from "zod"

// Schema for validating timeframe string format
export const timeframeSchema = z.string().regex(/^(\d+(?:\.\d+)?)([hdm])$/, {
  message:
    "Invalid timeframe format. Expected format: <number><unit> where unit is m(minute), h(hour), or d(day)",
})

// Main WorkEvent schema
export const workEventSchema = z.object({
  id: z.string().nullish(),
  timestamp: z.string().nullish(),
  timeframe: timeframeSchema.nonempty("Timeframe is required"),
  project: z.string().nonempty("Project is required"),
  description: z.string().nullish(),
  userId: z.string().nullish(),
  channel: z.string().nullish(),
  created: z.iso
    .datetime({ local: false })
    .nonempty()
    .default(() => new Date().toISOString()),
  updated: z.iso
    .datetime({ local: false })
    .nonempty()
    .default(() => new Date().toISOString()),
})

// Schema for partial updates (PUT requests) - compatible with what update function expects
export const workEventUpdateSchema = z
  .object({
    id: z.string().nonempty(),
    timestamp: z.string().nullish(),
    timeframe: timeframeSchema.nonempty("Timeframe is required"),
    project: z.string().nonempty(),
    description: z.string().nullish(),
    meta: z.record(z.string(), z.string().nullish()).optional(),
  })
  .partial()

export type WorkEvent = z.infer<typeof workEventSchema>
export type WorkEventUpdate = z.infer<typeof workEventUpdateSchema>

export interface GroupedEvent {
  date: string
  description: string
  project: string
  totalMinutes: number
  eventCount: number
  events: WorkEvent[]
}

export type TimeframeData = {
  value: number
  input: string
  unit: "minute" | "hour" | "day"
  duration: string
  durationInMinutes: number
}
