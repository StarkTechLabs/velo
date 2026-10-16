import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { z } from "zod"

const CONFIG_DIRECTORY = ".velo"
const USER_DB_FILENAME = "userDb.sqlite"

export const DEFAULT_API_PORT = 4317
export const DEFAULT_DASHBOARD_PORT = 4318

const port = z.number().int().min(1).max(65535)

export const configSchema = z.object({
  databaseFilePath: z
    .string()
    .min(1)
    .default(() => defaultDatabasePath()),
  api: z
    .object({ host: z.string().min(1).default("127.0.0.1"), port: port.default(DEFAULT_API_PORT) })
    .default({ host: "127.0.0.1", port: DEFAULT_API_PORT }),
  dashboard: z
    .object({ port: port.default(DEFAULT_DASHBOARD_PORT) })
    .default({ port: DEFAULT_DASHBOARD_PORT }),
})

export type Config = z.infer<typeof configSchema>

/** `~/.velo`, or `$VELO_HOME` when set. */
export const getConfigPath = () => {
  return process.env.VELO_HOME || path.join(os.homedir(), CONFIG_DIRECTORY)
}

export const getConfigJsonPath = () => {
  return path.join(getConfigPath(), "config.json")
}

/** Directory for pid files and logs of the optional api/dashboard processes. */
export const getRunPath = () => {
  return path.join(getConfigPath(), "run")
}

const defaultDatabasePath = () => path.join(getConfigPath(), USER_DB_FILENAME)

/** Returns the config merged with defaults, or null when none has been written yet. */
export const getConfig = (): Config | null => {
  const configPath = getConfigJsonPath()
  if (!fs.existsSync(configPath)) {
    return null
  }
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"))
  } catch (err) {
    throw new Error(`Could not read ${configPath}: ${(err as Error).message}`, { cause: err })
  }
  const result = configSchema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")
    throw new Error(`Invalid config at ${configPath}: ${issues}`)
  }
  return result.data
}

export const writeConfig = (config: Config) => {
  fs.mkdirSync(getConfigPath(), { recursive: true })
  fs.writeFileSync(getConfigJsonPath(), JSON.stringify(config, null, 2) + "\n")
}

export const ensureConfig = (): Config => {
  let config = getConfig()
  if (!config) {
    config = configSchema.parse({})
    writeConfig(config)
  }
  return config
}
