import { ZodError } from "zod"

/** Human-readable message for validation and runtime errors. */
export const errorMessage = (err: unknown): string => {
  if (err instanceof ZodError) return err.issues.map((i) => i.message).join("; ")
  return err instanceof Error ? err.message : String(err)
}
