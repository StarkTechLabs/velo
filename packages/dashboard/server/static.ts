import * as fs from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import * as path from "node:path"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
}

/**
 * Serves the built single-page app from `root`. Unknown paths without a file extension fall
 * back to index.html so client-side routes work; unknown files are 404s.
 */
export const serveStatic = (root: string) => {
  const base = path.resolve(root)

  return (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" }).end()
      return
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)
    } catch {
      res.writeHead(400).end()
      return
    }

    // resolve inside the root only; "..", encoded traversal and absolute paths are refused
    let file = path.join(base, pathname)
    if (file !== base && !file.startsWith(base + path.sep)) {
      res.writeHead(403).end()
      return
    }

    let stat = fs.statSync(file, { throwIfNoEntry: false })
    if (stat?.isDirectory()) {
      file = path.join(file, "index.html")
      stat = fs.statSync(file, { throwIfNoEntry: false })
    }
    if (!stat?.isFile()) {
      if (path.extname(pathname)) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found")
        return
      }
      file = path.join(base, "index.html")
      stat = fs.statSync(file, { throwIfNoEntry: false })
      if (!stat?.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Dashboard files not found")
        return
      }
    }

    const ext = path.extname(file)
    const hashed = file.includes(`${path.sep}assets${path.sep}`) // vite fingerprints these
    res.writeHead(200, {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
    })
    if (req.method === "HEAD") res.end()
    else fs.createReadStream(file).pipe(res)
  }
}
