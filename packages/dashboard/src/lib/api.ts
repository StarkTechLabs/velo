import type { Page, WorkEvent } from "@starktech/core/browser"

let base = ""

/** Where the API lives. Empty means same origin (the Vite dev proxy). */
export const setApiBase = (url: string) => {
  base = url.replace(/\/+$/, "")
}

export const getApiBase = () => base

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the API couldn't be reached at all. */
    readonly status: number,
  ) {
    super(message)
  }
}

export const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response
  try {
    res = await fetch(`${base}${path}`, init)
  } catch {
    throw new ApiError(
      `Can't reach the velo API at ${base || window.location.origin}. Start it with: velo api start`,
      0,
    )
  }
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`
    try {
      message = (await res.json()).error ?? message
    } catch {
      // not a JSON error body
    }
    throw new ApiError(message, res.status)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export type EventQuery = {
  term?: string
  projects?: string[]
  minDate?: Date
  maxDate?: Date
  page?: number
  pageSize?: number
}

const toParams = (query: EventQuery): URLSearchParams => {
  const params = new URLSearchParams()
  if (query.term) params.set("term", query.term)
  query.projects?.forEach((project) => params.append("project", project))
  if (query.minDate) params.set("min_date", query.minDate.toISOString())
  if (query.maxDate) params.set("max_date", query.maxDate.toISOString())
  if (query.page) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  return params
}

export const fetchEvents = (query: EventQuery): Promise<Page<WorkEvent>> =>
  request(`/api/events?${toParams(query)}`)

export type Health = { name: string; version: string; pid: number; home?: string | null }

export const fetchHealth = (): Promise<Health> => request("/api/health")

export const fetchProjects = (): Promise<string[]> => request("/api/projects")

export type EventInput = {
  timestamp: Date
  project: string
  description: string
  timeframe: string
}

/** Creates the event, or updates it when an id is given. */
export const saveEvent = (id: string | undefined, values: EventInput): Promise<WorkEvent> =>
  request(id ? `/api/events/${id}` : "/api/events", {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...values, timestamp: values.timestamp.toISOString() }),
  })

export const deleteEvent = (id: string): Promise<void> =>
  request(`/api/events/${id}`, { method: "DELETE" })

/** CSV of every event matching the query (not just the loaded page). */
export const fetchCsv = async (query: EventQuery): Promise<string> => {
  const { page: _page, pageSize: _pageSize, ...filter } = query
  let res: Response
  try {
    res = await fetch(`${base}/api/export.csv?${toParams(filter)}`)
  } catch {
    throw new ApiError("Can't reach the velo API. Start it with: velo api start", 0)
  }
  if (!res.ok) throw new ApiError(`Export failed (${res.status})`, res.status)
  return res.text()
}
