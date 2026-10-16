import { uuidv7 } from "./uuid"

describe("uuidv7", () => {
  it("produces a valid v7 UUID", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })

  it("encodes the timestamp in the first 48 bits", () => {
    expect(uuidv7(0x0123456789ab).startsWith("01234567-89ab-7")).toBe(true)
  })

  it("sorts by creation time", () => {
    expect(uuidv7(1000) < uuidv7(2000)).toBe(true)
  })

  it("is unique", () => {
    expect(new Set(Array.from({ length: 1000 }, () => uuidv7())).size).toBe(1000)
  })
})
