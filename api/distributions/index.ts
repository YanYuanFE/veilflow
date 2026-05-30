import type { VercelRequest, VercelResponse } from "@vercel/node"
import { and, desc, eq } from "drizzle-orm"
import { db } from "../_db"
import { distributions, distributionType } from "../_schema"
import { bad, HttpError, methodNotAllowed, normalizeAddress, requireAddress } from "../_http"

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/
const TYPES = distributionType.enumValues

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") return await list(req, res)
    if (req.method === "POST") return await create(req, res)
    return methodNotAllowed(res, ["GET", "POST"])
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    if (isUniqueViolation(e)) return bad(res, "Slug already taken", 409)
    throw e
  }
}

// GET /api/distributions?creator=0x..  -> issuer's distributions (dashboard)
// GET /api/distributions?slug=my-drop  -> single distribution (public claim page)
async function list(req: VercelRequest, res: VercelResponse) {
  const { creator, slug } = req.query
  if (typeof slug === "string") {
    const [row] = await db.select().from(distributions).where(eq(distributions.slug, slug)).limit(1)
    if (!row) return bad(res, "Not found", 404)
    return res.status(200).json(row)
  }
  if (typeof creator !== "string") return bad(res, "creator or slug query param required")
  const rows = await db
    .select()
    .from(distributions)
    .where(eq(distributions.creator, normalizeAddress(creator, "creator")))
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

  const creator = normalizeAddress(b.creator, "creator")
  const token = requireAddress(b.token, "token") // checksummed; chain expects checksum
  const chainId = typeof b.chainId === "number" ? b.chainId : 11_155_111
  const config = b.config && typeof b.config === "object" ? (b.config as Record<string, unknown>) : {}

  const [row] = await db
    .insert(distributions)
    .values({ name, slug, type: b.type as (typeof TYPES)[number], creator, token, chainId, config })
    .returning()
  return res.status(201).json(row)
}

function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false
  const code = (e as { code?: unknown }).code
  const msg = (e as { message?: unknown }).message
  return code === "23505" || (typeof msg === "string" && msg.includes("duplicate key"))
}
