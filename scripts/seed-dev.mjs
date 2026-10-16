// Prints sample data as CSV: weekdays for the last N days (default 21), a few events a day
// across a handful of projects. Import it into your dev sandbox:
//
//   node scripts/seed-dev.mjs > /tmp/velo-seed.csv && velo import csv /tmp/velo-seed.csv
//
// The ids are derived from the content, so importing the same output twice is harmless.
import process from "node:process"

const days = Number(process.argv[2] ?? 21)
const projects = {
  velo: ["Port dashboard", "Write tests", "Service management", "Importer for CSV"],
  "client-portal": ["Review PR #214", "Fix login redirect", "Sprint planning"],
  infra: ["Rotate certificates", "Upgrade node image"],
  docs: ["Development guide", "README"],
}
const hours = [0.25, 0.5, 0.75, 1, 1.5, 2]

// small deterministic generator so everyone gets the same picture
let state = 7
const random = () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const pick = (list) => list[Math.floor(random() * list.length)]
const pad = (n) => String(n).padStart(2, "0")

const rows = []
for (let back = days - 1; back >= 0; back--) {
  const day = new Date()
  day.setDate(day.getDate() - back)
  if ([0, 6].includes(day.getDay())) continue
  const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
  for (let i = 0; i < 2 + Math.floor(random() * 3); i++) {
    const project = pick(Object.keys(projects))
    rows.push([date, project, pick(projects[project]), pick(hours).toFixed(2)])
  }
}
console.log("date,project,description,hours")
for (const row of rows) console.log(row.join(","))
