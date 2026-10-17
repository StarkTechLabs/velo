const parse = (version: string): [number, number, number] | null => {
  if (version.trim() === "0.0.0-dev") return null // what an unbuilt dev run reports
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * Whether two velo components (cli, api, dashboard) can be expected to work together.
 * Before 1.0 a minor bump may change the API, so 0.x versions must match on major and minor;
 * from 1.0 on, matching major is enough. Unparseable versions (a dev build) are given the
 * benefit of the doubt.
 */
export const versionsCompatible = (a: string, b: string): boolean => {
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return true
  if (x[0] !== y[0]) return false
  return x[0] >= 1 || x[1] === y[1]
}
