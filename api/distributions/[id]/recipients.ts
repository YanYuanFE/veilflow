import type { VercelRequest, VercelResponse } from "@vercel/node"
import { desc, eq } from "drizzle-orm"
import { db } from "../../_db"
import { distributions, recipients } from "../../_schema"
import { bad, HttpError, methodNotAllowed, normalizeAddress } from "../../_http"

const HEX_RE = /^0x[0-9a-fA-F]+$/

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const distributionId = req.query.id
  if (typeof distributionId !== "string") return bad(res, "id required")
  try {
    if (req.method === "GET") return await list(distributionId, res)
    if (req.method === "POST") return await add(distributionId, req, res)
    return methodNotAllowed(res, ["GET", "POST"])
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    throw e
  }
}

async function list(distributionId: string, res: VercelResponse) {
  const rows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.distributionId, distributionId))
    .orderBy(desc(recipients.createdAt))
  return res.status(200).json(rows)
}

// Store a ciphertext artifact the admin's browser produced. We persist the
// encrypted handle, its KMS proof, and the EIP-712 signature — never a plaintext amount.
async function add(distributionId: string, req: VercelRequest, res: VercelResponse) {
  const [parent] = await db
    .select({ id: distributions.id })
    .from(distributions)
    .where(eq(distributions.id, distributionId))
    .limit(1)
  if (!parent) return bad(res, "Distribution not found", 404)

  const b = (req.body ?? {}) as Record<string, unknown>
  const recipient = normalizeAddress(b.recipient, "recipient")
  const handle = hex(b.handle, "handle")
  const inputProof = hex(b.inputProof, "inputProof")
  const signature = b.signature === undefined ? null : hex(b.signature, "signature")

  const [row] = await db
    .insert(recipients)
    .values({ distributionId, recipient, handle, inputProof, signature })
    .returning()
  return res.status(201).json(row)
}

function hex(value: unknown, field: string): string {
  if (typeof value !== "string" || !HEX_RE.test(value)) throw new HttpError(400, `${field} must be a hex string`)
  return value
}
