import { Config } from "@starktech/core"

export type ServiceName = "api" | "dashboard"

/**
 * What a running service reports about itself. The api serves this at `/api/health`, the
 * dashboard at `/config.json` (alongside the `apiUrl` its page needs). `name` is how the CLI
 * tells our service apart from some other program that happens to hold the port.
 */
export type ServiceInfo = { name: string; version: string; pid: number }

export interface ServiceDef {
  name: ServiceName
  label: string
  packageName: string
  binName: string
  /** Value of `name` in the service's self-description. */
  identity: string
  /** Path that returns the self-description as JSON. */
  probePath: string
  host(config: Config): string
  port(config: Config): number
  /** Where a person should open/call it. */
  url(config: Config): string
  /** Command-line arguments for the service's bin. */
  args(config: Config): string[]
}

const WILDCARD_HOSTS = new Set(["0.0.0.0", "::", "[::]"])

/** An address we can connect to for a host a server may be bound to. */
export const connectHost = (host: string): string => (WILDCARD_HOSTS.has(host) ? "127.0.0.1" : host)

export const apiUrl = (config: Config): string =>
  `http://${connectHost(config.api.host)}:${config.api.port}`

export const SERVICES: Record<ServiceName, ServiceDef> = {
  api: {
    name: "api",
    label: "API",
    packageName: "@starktech/velo-api",
    binName: "velo-api",
    identity: "velo-api",
    probePath: "/api/health",
    host: (config) => connectHost(config.api.host),
    port: (config) => config.api.port,
    url: apiUrl,
    args: (config) => ["--host", config.api.host, "--port", String(config.api.port)],
  },
  dashboard: {
    name: "dashboard",
    label: "Dashboard",
    packageName: "@starktech/velo-dashboard",
    binName: "velo-dashboard",
    identity: "velo-dashboard",
    probePath: "/config.json",
    host: () => "127.0.0.1",
    port: (config) => config.dashboard.port,
    url: (config) => `http://localhost:${config.dashboard.port}`,
    args: (config) => ["--port", String(config.dashboard.port), "--api-url", apiUrl(config)],
  },
}

export const SERVICE_ORDER: ServiceName[] = ["api", "dashboard"]
