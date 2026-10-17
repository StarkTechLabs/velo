declare const __VERSION__: string

/** This CLI's version, injected at build time (see esbuild.config.js). */
export const VERSION = typeof __VERSION__ === "undefined" ? "0.0.0-dev" : __VERSION__
