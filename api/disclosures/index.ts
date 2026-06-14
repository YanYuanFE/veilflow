import type { VercelRequest, VercelResponse } from "@vercel/node"
import { desc, eq } from "drizzle-orm"
import { db } from "../_db"
import { disclosures } from "../_schema"
import { bad, HttpError, methodNotAllowed, normalizeAddress, requireAddress } from "../_http"

const VID_RE = /^0x[0-9a-fA-F]{64}$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await list(req, res)
    if (req.method === "POST") return await create(req, res)
    return methodNotAllowed(res, ["GET", "POST"])
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    throw e
  }
}

// GET /api/disclosures?party=0x.. -> figures disclosed TO this auditor wallet
async function list(req: VercelRequest, res: VercelResponse) {
  const { party } = req.query
  if (typeof party !== "string") return bad(res, "party query param required")
  const rows = await db
    .select()
    .from(disclosures)
    .where(eq(disclosures.party, normalizeAddress(party, "party")))
    .orderBy(desc(disclosures.createdAt))
  return res.status(200).json(rows)
}

// POST -> record a grant after the on-chain discloseToParty succeeds.
async function create(req: VercelRequest, res: VercelResponse) {
  const b = (req.body ?? {}) as Record<string, unknown>
  const manager = requireAddress(b.manager, "manager")
  const party = normalizeAddress(b.party, "party")
  const recipient = typeof b.recipient === "string" && b.recipient ? normalizeAddress(b.recipient, "recipient") : null
  const vestingId = typeof b.vestingId === "string" ? b.vestingId : ""
  if (!VID_RE.test(vestingId)) throw new HttpError(400, "vestingId must be a 32-byte hex")
  const disclosureType = typeof b.disclosureType === "number" ? b.disclosureType : NaN
  if (!Number.isInteger(disclosureType)) throw new HttpError(400, "disclosureType must be an integer")
  const distributionId = typeof b.distributionId === "string" ? b.distributionId : null

  const [row] = await db
    .insert(disclosures)
    .values({ manager, party, recipient, vestingId, disclosureType, distributionId })
    .returning()
  return res.status(201).json(row)
}
