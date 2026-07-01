import type { VercelResponse } from "@vercel/node"
import { getAddress, isAddress } from "viem"

export function bad(res: VercelResponse, message: string, status = 400) {
  return res.status(status).json({ error: message })
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "))
  return res.status(405).json({ error: `Method not allowed. Allowed: ${allowed.join(", ")}` })
}

// Checksummed address or throw — callers map the throw to a 400.
export function requireAddress(value: unknown, field: string): `0x${string}` {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new HttpError(400, `Invalid ${field} address`)
  }
  return getAddress(value)
}

// Lowercased address for storage/equality (we don't checksum-compare in SQL).
export function normalizeAddress(value: unknown, field: string): string {
  return requireAddress(value, field).toLowerCase()
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// Postgres unique-constraint violation — callers map this to a 409. Drizzle wraps
// the driver error, so the pg 23505 code / "duplicate key" text lives on a nested
// `cause`, not the top-level "Failed query: …" wrapper — walk the cause chain.
export function isUniqueViolation(e: unknown): boolean {
  let cur: unknown = e
  for (let depth = 0; depth < 5 && cur && typeof cur === "object"; depth++) {
    const code = (cur as { code?: unknown }).code
    const msg = (cur as { message?: unknown }).message
    if (code === "23505") return true
    if (typeof msg === "string" && msg.includes("duplicate key")) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}
