import { versionsCompatible } from "./version"

describe("versionsCompatible", () => {
  it("requires the same minor while pre-1.0 (a minor bump may break things)", () => {
    expect(versionsCompatible("0.1.0", "0.1.7")).toBe(true)
    expect(versionsCompatible("0.1.0", "0.2.0")).toBe(false)
    expect(versionsCompatible("0.2.3", "0.1.9")).toBe(false)
  })

  it("only requires the same major from 1.0", () => {
    expect(versionsCompatible("1.0.0", "1.4.2")).toBe(true)
    expect(versionsCompatible("1.9.0", "2.0.0")).toBe(false)
    expect(versionsCompatible("0.9.0", "1.0.0")).toBe(false)
  })

  it("accepts a leading v and prerelease suffixes", () => {
    expect(versionsCompatible("v0.1.0", "0.1.3-beta.1")).toBe(true)
  })

  it("doesn't cry wolf about versions it can't read (dev runs report 0.0.0-dev)", () => {
    expect(versionsCompatible("0.0.0-dev", "0.3.0")).toBe(true)
    expect(versionsCompatible("0.3.0", "0.0.0-dev")).toBe(true)
    expect(versionsCompatible("unknown", "0.1.0")).toBe(true)
  })
})
