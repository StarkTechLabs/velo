import { Config } from "@starktech/core"

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
  return {
    state: "running",
    info: { name: body.name, version: String(body.version ?? "unknown"), pid: body.pid },
  }
}
