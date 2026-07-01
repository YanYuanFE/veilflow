import type { VercelRequest, VercelResponse } from "@vercel/node"
import { desc, eq, inArray } from "drizzle-orm"
import { db } from "../_db.js"
import { distributions, distributionType, recipients } from "../_schema.js"
import { bad, HttpError, isUniqueViolation, methodNotAllowed, normalizeAddress, requireAddress } from "../_http.js"
import { requireSession } from "../_auth.js"
import { validateConfig } from "../_config.js"

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/
const TYPES = distributionType.enumValues

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await list(req, res)
    if (req.method === "POST") return await create(req, res)
    return methodNotAllowed(res, ["GET", "POST"])
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    if (isUniqueViolation(e)) return bad(res, "That slug is already taken — pick another one.", 409)
    throw e
  }
}

// GET /api/distributions?creator=0x..   -> issuer's distributions (dashboard)
// GET /api/distributions?slug=my-drop    -> single distribution (public claim page)
// GET /api/distributions?recipient=0x..  -> distributions where this address has a claim
async function list(req: VercelRequest, res: VercelResponse) {
  const { creator, slug, recipient } = req.query
  if (typeof slug === "string") {
    const [row] = await db.select().from(distributions).where(eq(distributions.slug, slug)).limit(1)
    if (!row) return bad(res, "Not found", 404)
    return res.status(200).json(row)
  }
  if (typeof recipient === "string") {
    const addr = normalizeAddress(recipient, "recipient")
    const links = await db
      .select({ id: recipients.distributionId })
      .from(recipients)
      .where(eq(recipients.recipient, addr))
    const ids = [...new Set(links.map((l) => l.id))]
    if (ids.length === 0) return res.status(200).json([])
    const rows = await db
      .select()
      .from(distributions)
      .where(inArray(distributions.id, ids))
      .orderBy(desc(distributions.createdAt))
    return res.status(200).json(rows)
  }
  if (typeof creator !== "string") return bad(res, "creator, slug or recipient query param required")
  // Owner-scoped: you can only list your own distributions.
  const want = normalizeAddress(creator, "creator")
  if (requireSession(req) !== want) throw new HttpError(403, "You can only list your own distributions")
  const rows = await db
    .select()
    .from(distributions)
    .where(eq(distributions.creator, want))
    .orderBy(desc(distributions.createdAt))
  return res.status(200).json(rows)
}

async function create(req: VercelRequest, res: VercelResponse) {
  const b = (req.body ?? {}) as Record<string, unknown>

  const name = typeof b.name === "string" ? b.name.trim() : ""
  if (!name) throw new HttpError(400, "name is required")

  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : ""
  if (!SLUG_RE.test(slug)) throw new HttpError(400, "slug must be 3-50 chars, [a-z0-9-]")

  if (!TYPES.includes(b.type as (typeof TYPES)[number])) {
    throw new HttpError(400, `type must be one of ${TYPES.join(", ")}`)
  }

  const creator = requireSession(req) // owner is the signed-in wallet, not a client-supplied field
  const token = requireAddress(b.token, "token") // checksummed; chain expects checksum
  const chainId = typeof b.chainId === "number" ? b.chainId : 11_155_111
  const config = validateConfig(b.type as string, b.config)

  const [row] = await db
    .insert(distributions)
    .values({ name, slug, type: b.type as (typeof TYPES)[number], creator, token, chainId, config })
    .returning()
  return res.status(201).json(row)
}
