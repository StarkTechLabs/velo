/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  watchman: false,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/lib/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}
