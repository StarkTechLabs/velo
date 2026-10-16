import { setApiBase } from "./api"

/**
 * The dashboard server answers `/config.json` with `{name, version, pid, apiUrl}` (this is
 * also how the velo CLI detects it). In development the Vite dev server answers with an empty
 * `apiUrl` and proxies `/api`.
 */
export const loadRuntimeConfig = async (): Promise<{ apiUrl: string }> => {
  try {
    const res = await fetch("/config.json")
    const { apiUrl } = await res.json()
    setApiBase(typeof apiUrl === "string" ? apiUrl : "")
    return { apiUrl: typeof apiUrl === "string" ? apiUrl : "" }
  } catch {
    setApiBase("")
    return { apiUrl: "" }
  }
}
