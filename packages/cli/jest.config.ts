/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/lib/testing/setup.ts"],
  watchman: false,
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        // the package is ESM (bundled by esbuild) but jest runs CommonJS
        tsconfig: {
          isolatedModules: true,
          module: "commonjs",
          moduleResolution: "node10",
          esModuleInterop: true,
          allowJs: true,
          target: "es2022",
        },
      },
    ],
  },
  // commander is ESM-only
  transformIgnorePatterns: ["/node_modules/(?!commander/)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/lib/$1",
    "^@starktech/core$": "<rootDir>/../core/lib/index.ts",
  },
}
