/**
 * Polls the velo API's health endpoint until it answers, for at most `seconds`. Resolves to
 * whether it came up. Used at login, where the API and dashboard start at about the same time
 * and the dashboard should not open before the API it talks to is ready.
 */
export const waitForApi = async (
  apiUrl: string,
  seconds: number,
  {
    log = (_line: string) => {},
    intervalMs = 500,
  }: { log?: (line: string) => void; intervalMs?: number } = {},
): Promise<boolean> => {
  const deadline = Date.now() + seconds * 1000
  const url = `${apiUrl.replace(/\/+$/, "")}/api/health`
  let announced = false

  for (;;) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) })
      if (res.ok) return true
    } catch {
      // not up yet
    }
    if (Date.now() >= deadline) return false
    if (!announced) {
      log(`waiting up to ${seconds}s for the velo API at ${apiUrl}`)
      announced = true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
