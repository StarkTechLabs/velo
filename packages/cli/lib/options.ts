import { EventFilter, endOfDay, parseDateInput, startOfDay } from "@starktech/core"
import { Command } from "commander"

type FilterOptions = {
  project?: string[]
  search?: string
  from?: string
  to?: string
  today?: boolean
}

const collect = (value: string, previous: string[]) => [...previous, value]

/** Adds the filter flags shared by `list` and `export`. */
export const addFilterOptions = (command: Command): Command =>
  command
    .option("-p, --project <name>", "Only this project (repeat for several)", collect, [])
    .option("-s, --search <term>", "Match text in the project or description")
    .option("--from <date>", "On or after YYYY-MM-DD (or an ISO timestamp)")
    .option("--to <date>", "On or before YYYY-MM-DD (or an ISO timestamp)")
    .option("--today", "Only today")

export const filterFromOptions = (options: FilterOptions): EventFilter => ({
  term: options.search,
  projects: options.project?.length ? options.project : undefined,
  minDate: options.today ? startOfDay() : options.from ? parseDateInput(options.from) : undefined,
  maxDate: options.today ? endOfDay() : options.to ? parseDateInput(options.to, "end") : undefined,
})
