import { readFileSync } from "node:fs"

import { build } from "esbuild"

const { version } = JSON.parse(readFileSync("package.json", "utf8"))

// the static server has no runtime dependencies; the app itself is built by vite into dist/app
await build({
  entryPoints: ["server/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/main.js",
  banner: { js: "#!/usr/bin/env node\n" },
  sourcemap: true,
  minify: true,
  define: { __VERSION__: JSON.stringify(version) },
})
console.log("Server build completed successfully!")
