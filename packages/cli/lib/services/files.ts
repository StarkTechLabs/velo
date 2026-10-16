import * as fs from "node:fs"
import * as path from "node:path"

import { getRunPath } from "@starktech/core"

import { ServiceName } from "./definitions"

const MAX_LOG_BYTES = 5 * 1024 * 1024

export const pidFile = (name: ServiceName) => path.join(getRunPath(), `${name}.pid`)
export const logFile = (name: ServiceName) => path.join(getRunPath(), `${name}.log`)

export const readPid = (name: ServiceName): number | null => {
  try {
    const pid = Number.parseInt(fs.readFileSync(pidFile(name), "utf8"), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : null
  } catch {
    return null
  }
}

export const writePid = (name: ServiceName, pid: number) => {
  fs.mkdirSync(getRunPath(), { recursive: true })
  fs.writeFileSync(pidFile(name), `${pid}\n`)
}

export const removePid = (name: ServiceName) => fs.rmSync(pidFile(name), { force: true })

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM" // exists, owned by someone else
  }
}

/** Opens the log for appending, keeping one previous generation once it passes 5 MB. */
export const openLog = (name: ServiceName): number => {
  fs.mkdirSync(getRunPath(), { recursive: true })
  const file = logFile(name)
  try {
    if (fs.statSync(file).size > MAX_LOG_BYTES) fs.renameSync(file, `${file}.1`)
  } catch {
    // no log yet
  }
  return fs.openSync(file, "a")
}

/** The last `lines` lines of a file (reads at most the final megabyte). */
export const tailFile = (file: string, lines: number): string[] => {
  let fd: number
  try {
    fd = fs.openSync(file, "r")
  } catch {
    return []
  }
  try {
    const { size } = fs.fstatSync(fd)
    const length = Math.min(size, 1024 * 1024)
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, size - length)
    const all = buffer.toString("utf8").split("\n")
    if (all.at(-1) === "") all.pop()
    return all.slice(-lines)
  } finally {
    fs.closeSync(fd)
  }
}
