import knex from "knex"

import { getConfig } from "@/common/config"

declare global {
  var db: knex.Knex
}
if (!global.db) {
  const config = getConfig()
  if (!config) {
    throw new Error("Configuration not found. Please run 'velo init' to set up the configuration.")
  }

  global.db = knex({
    client: "better-sqlite3",
    connection: {
      filename: config.databaseFilePath,
    },
  })
}

const db = global.db
export default db
