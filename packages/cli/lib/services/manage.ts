import { spawn } from "node:child_process"
import * as fs from "node:fs"

import { Config } from "@starktech/core"

import { AutostartManager, getManager } from "@/autostart/manager"
import { VERSION } from "@/version"

import { SERVICES, SERVICE_ORDER, ServiceDef, ServiceName } from "./definitions"
import { isAlive, logFile, openLog, readPid, removePid, tailFile, writePid } from "./files"
import { Probe, probe } from "./probe"
import { NotInstalledError, resolveBin } from "./resolve"

/** Seams the tests replace. */
export const serviceDeps = {
  resolveBin,
  /** This CLI's version, for the cross-package compatibility warning. */
  cliVersion: () => VERSION,
  /** The OS service manager (launchd/systemd), or null where autostart isn't supported. */
  autostart: (): AutostartManager | null => getManager(),
  startTimeoutMs: 10_000,
  stopTimeoutMs: 5_000,
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export type ServiceStatus = {
  name: ServiceName
  label: string
  installed: boolean
  state: "running" | "stopped" | "conflict"
  url: string
  pid?: number
  version?: string
  detail?: string
}

export const getStatus = async (name: ServiceName, config: Config): Promise<ServiceStatus> => {
  const def = SERVICES[name]
  const base = { name, label: def.label, url: def.url(config) }
  let installed = true
  try {
    serviceDeps.resolveBin(def)
  } catch {
    installed = false
  }

  const result = await probe(def, config)
  if (result.state === "running") {
    return {
      ...base,
      installed,
      state: "running",
      pid: result.info.pid,
      version: result.info.version,
    }
  }
  if (result.state === "foreign") {
    return {
      ...base,
      installed,
      state: "conflict",
      detail: `port ${def.port(config)} is in use by another program (${result.detail})`,
    }
  }
  return { ...base, installed, state: "stopped" }
}

export const getAllStatuses = (config: Config) =>
  Promise.all(SERVICE_ORDER.map((name) => getStatus(name, config)))

const startupFailure = (def: ServiceDef, headline: string): Error => {
  const tail = tailFile(logFile(def.name), 8)
  const lines = tail.length ? `\n${tail.map((l) => `  ${l}`).join("\n")}` : ""
  return new Error(`${headline}${lines}\nFull log: velo ${def.name} logs`)
}

export type StartResult = {
  status: "started" | "already-running"
  pid: number
  url: string
  /** Set when the OS service manager (rather than this process) started it. */
  via?: AutostartManager["kind"]
}

/** Waits for a service to answer its probe; returns its pid, or null on timeout. */
export const waitUntilRunning = async (
  def: ServiceDef,
  config: Config,
  timeoutMs: number,
): Promise<number | null> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = await probe(def, config, 500)
    if (result.state === "running") return result.info.pid
    await sleep(100)
  }
  return null
}

/** Starts a service unless it's already up, and waits until it reports healthy. */
export const startService = async (name: ServiceName, config: Config): Promise<StartResult> => {
  const def = SERVICES[name]
  const current = await probe(def, config)
  if (current.state === "running") {
    return { status: "already-running", pid: current.info.pid, url: def.url(config) }
  }
  if (current.state === "foreign") {
    throw new Error(
      `Cannot start the ${def.label}: port ${def.port(config)} is in use by another program ` +
        `(${current.detail}).\nPick another port with: velo configure --${name}-port <port>`,
    )
  }

  // Set up for autostart? Then the OS service manager owns this service: ask it to start it
  // rather than spawning a second, unmanaged copy next to it.
  const manager = serviceDeps.autostart()
  if (manager?.isInstalled(name)) {
    await manager.start(name)
    const pid = await waitUntilRunning(def, config, serviceDeps.startTimeoutMs)
    if (pid === null) {
      throw startupFailure(
        def,
        `${manager.kind} started the ${def.label}, but it did not become healthy within ${Math.round(serviceDeps.startTimeoutMs / 1000)}s.`,
      )
    }
    return { status: "started", pid, url: def.url(config), via: manager.kind }
  }

  const script = serviceDeps.resolveBin(def)
  const logFd = openLog(name)
  let exit: { code: number | null; signal: string | null } | undefined
  let spawnError: Error | undefined
  const child = spawn(process.execPath, [script, ...def.args(config)], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
  })
  child.once("exit", (code, signal) => (exit = { code, signal }))
  child.once("error", (err) => (spawnError = err))
  child.unref()

  const pid = child.pid
  if (pid === undefined) {
    throw startupFailure(def, `Could not start the ${def.label}: ${spawnError?.message}`)
  }
  writePid(name, pid)

  const deadline = Date.now() + serviceDeps.startTimeoutMs
  try {
    while (Date.now() < deadline) {
      if (exit) {
        removePid(name)
        const how = exit.signal ? `signal ${exit.signal}` : `code ${exit.code}`
        throw startupFailure(def, `The ${def.label} exited during startup (${how}).`)
      }
      const result: Probe = await probe(def, config, 500)
      if (result.state === "running" && result.info.pid === pid) {
        return { status: "started", pid, url: def.url(config) }
      }
      await sleep(100)
    }
  } finally {
    // the log fd is only needed by the child
    fs.closeSync(logFd)
  }

  // never became healthy: don't leave a half-started process behind
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    // already gone
  }
  removePid(name)
  throw startupFailure(
    def,
    `The ${def.label} did not become healthy within ${Math.round(serviceDeps.startTimeoutMs / 1000)}s.`,
  )
}

export type StopResult = "stopped" | "not-running"

/**
 * Stops a service. The process signalled is the one the service itself reports at its health
 * endpoint, never one inferred from a pid file or port, so a stale pid file or a different
 * program on the port can't make us kill the wrong thing.
 */
export const stopService = async (name: ServiceName, config: Config): Promise<StopResult> => {
  const def = SERVICES[name]
  const current = await probe(def, config)

  if (current.state === "foreign") {
    throw new Error(
      `The ${def.label} is not running: port ${def.port(config)} is in use by another program ` +
        `(${current.detail}). Not touching it.`,
    )
  }
  if (current.state === "down") {
    const pid = readPid(name)
    if (pid === null || !isAlive(pid)) removePid(name)
    return "not-running"
  }

  const { pid } = current.info
  try {
    process.kill(pid, "SIGTERM")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ESRCH") throw err
  }

  const deadline = Date.now() + serviceDeps.stopTimeoutMs
  while (Date.now() < deadline) {
    if ((await probe(def, config, 500)).state === "down") {
      removePid(name)
      return "stopped"
    }
    await sleep(100)
  }
  throw new Error(
    `The ${def.label} (pid ${pid}) did not stop within ${Math.round(serviceDeps.stopTimeoutMs / 1000)}s. ` +
      `If it is stuck: kill -9 ${pid}`,
  )
}

export { NotInstalledError }
