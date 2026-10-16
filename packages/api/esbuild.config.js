import { readFileSync } from "node:fs"

import { build } from "esbuild"

const isWatch = process.argv.includes("--watch")
const { version } = JSON.parse(readFileSync("package.json", "utf8"))

const buildOptions = {
  entryPoints: ["lib/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: "dist",
  banner: { js: "#!/usr/bin/env node\n" },
  sourcemap: true,
  minify: !isWatch,
  // runtime dependencies (see package.json); @starktech/core and zod are bundled
  external: ["express", "knex", "better-sqlite3"],
  define: {
    "process.env.NODE_ENV": '"production"',
    __VERSION__: JSON.stringify(version),
  },
}

try {
  if (isWatch) {
    const context = await (await import("esbuild")).context(buildOptions)
    await context.watch()
    console.log("Watching for changes...")
  } else {
    await build(buildOptions)
    console.log("Build completed successfully!")
  }
} catch (error) {
  console.error("Build failed:", error)
  process.exit(1)
}
