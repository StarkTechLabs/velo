import { randomBytes } from "node:crypto"

/** RFC 9562 UUID v7: 48-bit unix ms timestamp followed by random bits. Sortable by creation time. */
export const uuidv7 = (now: number = Date.now()): string => {
  const bytes = randomBytes(16)
  bytes.writeUIntBE(now, 0, 6)
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
