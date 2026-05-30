import type { VercelRequest, VercelResponse } from "@vercel/node"
import { eq } from "drizzle-orm"
import { db } from "../_db"
import { distributions, distributionStatus, type NewDistribution } from "../_schema"
import { bad, HttpError, methodNotAllowed, requireAddress } from "../_http"

const STATUSES = distributionStatus.enumValues
const TXHASH_RE = /^0x[0-9a-fA-F]{64}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id
  if (typeof id !== "string") return bad(res, "id required")
  try {
    if (req.method === "GET") return await get(id, res)
    if (req.method === "PATCH") return await patch(id, req, res)
    return methodNotAllowed(res, ["GET", "PATCH"])
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    throw e
  }
}

async function get(id: string, res: VercelResponse) {
  const [row] = await db.select().from(distributions).where(eq(distributions.id, id)).limit(1)
  if (!row) return bad(res, "Not found", 404)
  return res.status(200).json(row)
}

// Write-back / reconciliation. Idempotent: re-applying the same address/txHash/status
// (e.g. after a transient client failure) just overwrites with the same values.
async function patch(id: string, req: VercelRequest, res: VercelResponse) {
  const b = (req.body ?? {}) as Record<string, unknown>
  const update: Partial<NewDistribution> = { updatedAt: new Date() }

  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status as (typeof STATUSES)[number])) {
      throw new HttpError(400, `status must be one of ${STATUSES.join(", ")}`)
    }
    update.status = b.status as (typeof STATUSES)[number]
  }
  if (b.contractAddress !== undefined) {
    update.contractAddress = requireAddress(b.contractAddress, "contractAddress")
  }
  if (b.deployTxHash !== undefined) {
    if (typeof b.deployTxHash !== "string" || !TXHASH_RE.test(b.deployTxHash)) {
      throw new HttpError(400, "deployTxHash must be a 32-byte hex string")
    }
    update.deployTxHash = b.deployTxHash
  }
  if (b.config !== undefined) {
    if (typeof b.config !== "object" || b.config === null) throw new HttpError(400, "config must be an object")
    update.config = b.config as Record<string, unknown>
  }

  const [row] = await db.update(distributions).set(update).where(eq(distributions.id, id)).returning()
  if (!row) return bad(res, "Not found", 404)
  return res.status(200).json(row)
}
