import { build } from "esbuild"

const isWatch = process.argv.includes("--watch")

const shebangPlugin = {
  name: "shebang",
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, async (_args) => {
      // This is just a placeholder. esbuild should preserve the shebang by default,
      // but we include this plugin as a safety measure.
    })
  },
}

async function runBuild() {
  try {
    const buildOptions = {
      entryPoints: ["lib/main.ts"],
      bundle: true,
      platform: "node",
      target: "node22",
      format: "esm",
      outdir: "dist",
      plugins: [shebangPlugin],
      banner: {
        js: "#!/usr/bin/env node\n",
      },
      sourcemap: true,
      minify: !isWatch,
      external: ["commander"],
      define: {
        "process.env.NODE_ENV": '"production"',
      },
    }

    if (isWatch) {
      const context = await build.context(buildOptions)
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
}

runBuild()
