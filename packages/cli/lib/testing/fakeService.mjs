// Stand-in for velo-api / velo-dashboard in tests: serves the self-description on the right
// path, exits on SIGTERM. FAKE_MODE: "exit" dies at startup, "hang" never listens,
// "ignore-term" survives SIGTERM.
import http from "node:http"
import { setInterval } from "node:timers"

const args = process.argv.slice(2)
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
// like the real API, which reads its port from config.json when it isn't given one
const port = Number(arg("--port") ?? process.env.FAKE_API_PORT)
const mode = process.env.FAKE_MODE ?? ""

if (mode === "exit") {
  console.error("error: port 1 is already in use")
  process.exit(1)
}
if (mode === "hang") setInterval(() => {}, 1000)
else {
  const isApi = String(port) === process.env.FAKE_API_PORT
  const name = isApi ? "velo-api" : "velo-dashboard"
  const path = isApi ? "/api/health" : "/config.json"
  const server = http.createServer((req, res) => {
    if (req.url !== path) {
      res.statusCode = 404
      return res.end()
    }
    res.setHeader("Content-Type", "application/json")
    res.end(
      JSON.stringify({
        name,
        version: "0.0.0-test",
        pid: process.pid,
        args,
        home: arg("--home") ?? process.env.VELO_HOME,
      }),
    )
  })
  server.listen(port, arg("--host") ?? "127.0.0.1", () =>
    console.log(`${name} listening on ${port}`),
  )
  process.on("SIGTERM", () => {
    if (mode === "ignore-term") return
    server.close(() => process.exit(0))
    server.closeAllConnections()
  })
}
