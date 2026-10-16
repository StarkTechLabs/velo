import { readFileSync } from "node:fs"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"
import { defineConfig } from "vitest/config"

const { version } = JSON.parse(readFileSync("package.json", "utf8"))
const API_URL = process.env.VELO_API_URL ?? "http://127.0.0.1:4317"

/**
 * In development there is no velo-dashboard server, so answer `/config.json` ourselves with an
 * empty apiUrl (same origin) and proxy `/api` to the real API below.
 */
const devConfigJson = (): Plugin => ({
  name: "velo-dev-config",
  configureServer(server) {
    server.middlewares.use("/config.json", (_req, res) => {
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ name: "velo-dashboard", version, pid: process.pid, apiUrl: "" }))
    })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), devConfigJson()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: { outDir: "dist/app", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: API_URL,
        configure: (proxy) => {
          // the API only accepts browser requests from the dashboard's own origin; a proxied
          // request is server-to-server, so drop the dev server's Origin
          proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"))
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}", "server/**/*.spec.ts"],
  },
})
