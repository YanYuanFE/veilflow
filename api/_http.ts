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
