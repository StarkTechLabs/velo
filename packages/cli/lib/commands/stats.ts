import {
  Config,
  fetchPaginated,
  formatMinutesToTimeframeString,
  parseTimeframe,
} from "@starktech/core"
import { Command } from "commander"

import { CommandRegistration } from "@/types"

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export const statsCommand: CommandRegistration = {
  register(program: Command, config: Config) {
    const stats = program.command("stats").description("View time tracking statistics.")

    stats
      .command("today")
      .description("Show stats for today.")
      .action(async () => {
        const { data } = await fetchPaginated({
          userId: config.defaultUserId,
          minDate: startOfToday(),
          maxDate: endOfToday(),
          pageSize: 1000,
        })

        const dateLabel = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
        const divider = "─".repeat(40)
        console.log(`Today — ${dateLabel}`)
        console.log(divider)

        if (data.length === 0) {
          console.log("No events logged today.")
          return
        }

        // Compute totals and per-project minutes
        let totalMinutes = 0
        const byProject = new Map<string, number>()

        for (const event of data) {
          const parsed = parseTimeframe(event.timeframe)
          totalMinutes += parsed.durationInMinutes
          byProject.set(event.project, (byProject.get(event.project) ?? 0) + parsed.durationInMinutes)
        }

        const eventWord = data.length === 1 ? "event" : "events"
        console.log(`Total     ${formatMinutesToTimeframeString(totalMinutes)}  (${data.length} ${eventWord})`)

        // By project, sorted by most time first
        console.log("\nBy Project:")
        const maxProjectLen = Math.max(...Array.from(byProject.keys()).map((p) => p.length))
        const sortedProjects = Array.from(byProject.entries()).sort((a, b) => b[1] - a[1])
        for (const [project, minutes] of sortedProjects) {
          const timeStr = formatMinutesToTimeframeString(minutes)
          console.log(`  ${project.padEnd(maxProjectLen + 2)}${timeStr}`)
        }

        // Most recent event (data is ordered by timestamp desc)
        const last = data[0]
        console.log("\nLast Logged:")
        console.log(`  Project   : ${last.project}`)
        console.log(`  Event     : ${last.description ?? "(no description)"}`)
        console.log(`  Timeframe : ${last.timeframe}`)
        console.log(`  At        : ${formatTime(last.timestamp ?? new Date().toISOString())}`)
      })
  },
}
