/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/lib/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
}
