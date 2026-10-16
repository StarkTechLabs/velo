import * as path from "node:path"

import { Config, getConfigPath } from "@starktech/core"

import { ServiceDef, ServiceInfo } from "./definitions"

export type Probe =
  | { state: "running"; info: ServiceInfo }
  /** Nothing is listening. */
  | { state: "down" }
  /** Something is listening that isn't our service. */
  | { state: "foreign"; detail: string }

export const probe = async (def: ServiceDef, config: Config, timeoutMs = 1000): Promise<Probe> => {
  const url = `http://${def.host(config)}:${def.port(config)}${def.probePath}`
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: { code?: string } }
    if (e.cause?.code === "ECONNREFUSED") return { state: "down" }
    const detail = e.name === "TimeoutError" ? "it did not respond in time" : (e.message ?? "error")
    return { state: "foreign", detail }
  }

  let body: Partial<ServiceInfo> | null = null
  try {
    body = await res.json()
  } catch {
    // not JSON
  }
  if (!res.ok || body?.name !== def.identity || typeof body.pid !== "number") {
    return {
      state: "foreign",
      detail: `it answered ${res.status} but is not the velo ${def.label}`,
    }
  }
  // A velo service from a different data directory (say, your real ~/.velo while you work in a
  // sandbox) is not ours to adopt, report as running, or stop, even though it looks identical.
  // Services too old to report a home are given the benefit of the doubt.
  if (typeof body.home === "string" && path.resolve(body.home) !== path.resolve(getConfigPath())) {
    return {
      state: "foreign",
      detail: `it is the velo ${def.label} for a different data directory (${body.home})`,
    }
  }
  return {
    state: "running",
    info: { name: body.name, version: String(body.version ?? "unknown"), pid: body.pid },
  }
}
