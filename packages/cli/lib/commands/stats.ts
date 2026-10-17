import {
  Config,
  endOfDay,
  formatMinutesToTimeframeString,
  getStats,
  listEvents,
  startOfDay,
} from "@starktech/core"
import { Command } from "commander"

import { printJson, renderTable } from "@/format"
import { addFilterOptions, filterFromOptions } from "@/options"
import { CommandRegistration } from "@/types"

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

export const statsCommand: CommandRegistration = {
  register(program: Command, _config: Config) {
    const stats = program.command("stats").description("View time tracking statistics.")

    const summary = stats
      .command("summary")
      .description("Totals for any period: overall, by project, and by day.")
      .option("--json", "Output JSON")
    addFilterOptions(summary).action(async (options) => {
      const result = await getStats(filterFromOptions(options))
      if (options.json) return printJson(result)
      if (result.eventCount === 0) return console.log("No events found.")

      const hours = (minutes: number) => (minutes / 60).toFixed(2)
      const days = result.byDay.length
      console.log(
        `Total  ${hours(result.totalMinutes)}h  (${result.eventCount} ${result.eventCount === 1 ? "event" : "events"} over ${days} ${days === 1 ? "day" : "days"})\n`,
      )
      console.log(
        renderTable(
          ["PROJECT", "HOURS", "EVENTS"],
          result.byProject.map((p) => [p.project, hours(p.minutes), String(p.eventCount)]),
        ),
      )
    })

    stats
      .command("today")
      .description("Show stats for today.")
      .option("--json", "Output JSON")
      .action(async (options) => {
        const range = { minDate: startOfDay(), maxDate: endOfDay() }
        const stats = await getStats(range)
        const {
          data: [last],
        } = await listEvents({ ...range, pageSize: 1 })

        if (options.json) return printJson({ ...stats, last: last ?? null })

        const dateLabel = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
        const divider = "─".repeat(40)
        console.log(`Today — ${dateLabel}`)
        console.log(divider)

        if (stats.eventCount === 0) {
          console.log("No events logged today.")
          return
        }

        const eventWord = stats.eventCount === 1 ? "event" : "events"
        console.log(
          `Total     ${formatMinutesToTimeframeString(stats.totalMinutes)}  (${stats.eventCount} ${eventWord})`,
        )

        console.log("\nBy Project:")
        const maxProjectLen = Math.max(...stats.byProject.map((p) => p.project.length))
        for (const { project, minutes } of stats.byProject) {
          const timeStr = formatMinutesToTimeframeString(minutes)
          console.log(`  ${project.padEnd(maxProjectLen + 2)}${timeStr}`)
        }

        console.log("\nLast Logged:")
        console.log(`  Project   : ${last.project}`)
        console.log(`  Event     : ${last.description || "(no description)"}`)
        console.log(`  Timeframe : ${last.timeframe}`)
        console.log(`  At        : ${formatTime(last.timestamp)}`)
      })
  },
}
