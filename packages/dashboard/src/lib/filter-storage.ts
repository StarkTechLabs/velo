/** Single source for filter localStorage keys and initial hydration. Used by page (initial state) and filter components (persist on change). */

export const PROJECT_FILTER_KEY = "velo-project-filter"
export const DATE_FILTER_KEY = "velo-date-filter"

function parseStoredProjects(raw: string | null): string[] {
  if (!raw || typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (typeof parsed === "string") return [parsed]
    return []
  } catch {
    return []
  }
}

export function getInitialProjectFilter(): string[] {
  if (typeof window === "undefined") return []
  const stored = parseStoredProjects(localStorage.getItem(PROJECT_FILTER_KEY))
  return stored.length > 0 ? stored : []
}

export function getInitialDateFilter(): string {
  if (typeof window === "undefined") return ""
  return localStorage.getItem(DATE_FILTER_KEY) ?? ""
}
