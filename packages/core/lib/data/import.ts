import { getDb } from "../common/db"
import { parseTimeframe } from "../common/utils"
import { CreateEvent, createEventSchema } from "../types"

export type ImportResult = {
  imported: number
  /** Already present (matched by id), including soft-deleted events */
  skipped: number
  invalid: { index: number; error: string }[]
}

/**
 * Bulk-inserts events in one transaction. Events whose id already exists are skipped, so
 * imports with stable ids can be re-run safely. With `dryRun` nothing is written.
 */
export async function importEvents(
  events: CreateEvent[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, invalid: [] }
  const now = new Date().toISOString()
  const valid: { index: number; event: ReturnType<typeof createEventSchema.parse> }[] = []

  events.forEach((input, index) => {
    const parsed = createEventSchema.safeParse(input)
    if (!parsed.success) {
      result.invalid.push({ index, error: parsed.error.issues.map((i) => i.message).join("; ") })
    } else if (!parsed.data.id) {
      result.invalid.push({ index, error: "Imported events need an id" })
    } else {
      valid.push({ index, event: parsed.data })
    }
  })

  const db = getDb()
  const existing = new Set<string>()
  for (let i = 0; i < valid.length; i += 500) {
    const ids = valid.slice(i, i + 500).map((v) => v.event.id as string)
    const rows: { id: string }[] = await db("work_event").whereIn("id", ids).select("id")
    rows.forEach((r) => existing.add(r.id))
  }

  const fresh = valid.filter(({ event }) => {
    if (existing.has(event.id as string)) {
      result.skipped++
      return false
    }
    existing.add(event.id as string) // duplicates within the input
    return true
  })
  result.imported = fresh.length
  if (dryRun || fresh.length === 0) return result

  await db.transaction(async (trx) => {
    for (let i = 0; i < fresh.length; i += 100) {
      await trx("work_event").insert(
        fresh.slice(i, i + 100).map(({ event }) => ({
          id: event.id,
          timestamp: event.timestamp ?? now,
          timeframe: event.timeframe,
          minutes: parseTimeframe(event.timeframe).durationInMinutes,
          project: event.project,
          description: event.description,
          created: now,
          updated: now,
        })),
      )
    }
  })
  return result
}
