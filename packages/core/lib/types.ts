import { z } from "zod"

// Schema for validating timeframe string format
export const timeframeSchema = z.string().regex(/^(\d+(?:\.\d+)?)([hdm])$/, {
  message:
    "Invalid timeframe format. Expected format: <number><unit> where unit is m(minute), h(hour), or d(day)",
})

const idNameSchema = z.object({
  name: z.string().nullish(),
  id: z.string().nullish(),
})

// Schema for user object
const userSchema = idNameSchema

// Schema for team object
const teamSchema = idNameSchema

// Schema for channel object
const channelSchema = idNameSchema

// Main WorkEvent schema
export const workEventSchema = z.object({
  id: z.string().nullish(),
  timestamp: z.string().nullish(),
  timeframe: timeframeSchema.nonempty("Timeframe is required"),
  project: z.string().nonempty("Project is required"),
  description: z.string().nullish(),
  user: userSchema.nullish(),
  team: teamSchema.nullish(),
  channel: channelSchema.nullish(),
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

export type User = z.infer<typeof userSchema>
export type Team = z.infer<typeof teamSchema>
export type Channel = z.infer<typeof channelSchema>

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
