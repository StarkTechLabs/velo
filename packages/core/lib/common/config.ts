import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import * as uuid from "uuid"

const CONFIG_DIRECTORY = ".velo"
const DEFAULT_SERVER_PORT = 68586
const USER_DB_FILENAME = "userDb.sqlite"

export type Config = {
  defaultUserId: string
  server: ServerConfig
  databaseFilePath: string
}

export type ServerConfig = {
  port: number
}

export const getConfigPath = () => {
  return path.join(os.homedir(), CONFIG_DIRECTORY)
}

export const getConfigJsonPath = () => {
  return path.join(getConfigPath(), "config.json")
}

export const getConfig = (): Config | null => {
  const configPath = getConfigJsonPath()
  if (!fs.existsSync(configPath)) {
    return null
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

  return config
}

export const writeConfig = (config: Config) => {
  const dirPath = getConfigPath()
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath)
  }
  const configPath = getConfigJsonPath()
  fs.writeFileSync(configPath, JSON.stringify(config))
}

export const validateConfig = (config: Config) => {
  if (!config) {
    console.error("No config found!")
    console.error("Please run `velo init` to create a config file")
    return false
  }
  if (!config.defaultUserId) {
    console.error("No default user id found!")
    console.error("Please run `velo init to create a config file")
    return false
  }

  return true
}

export const ensureConfig = (): Config => {
  let config = getConfig()
  if (!config) {
    config = {
      defaultUserId: uuid.NIL,
      databaseFilePath: path.join(getConfigPath(), USER_DB_FILENAME),
      server: {
        port: DEFAULT_SERVER_PORT,
      },
    }
    writeConfig(config)
  }
  return config
}
