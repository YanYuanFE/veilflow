import type { VercelRequest, VercelResponse } from "@vercel/node"
import type { Hex } from "viem"
import { generateSiweNonce, parseSiweMessage, verifySiweMessage } from "viem/siwe"
import { bad, HttpError } from "../_http"
import {
  authClient,
  clearNonceCookie,
  clearSessionCookie,
  getSession,
  readNonce,
  setNonceCookie,
  setSessionCookie,
} from "../_auth"

// GET  /api/auth/nonce    -> { nonce }   (also sets the nonce cookie)
// POST /api/auth/verify   -> { address } (verifies SIWE message+signature, sets session)
// GET  /api/auth/me       -> { address | null }
// POST /api/auth/logout   -> { ok }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action
  try {
    if (action === "nonce" && req.method === "GET") return nonce(res)
    if (action === "verify" && req.method === "POST") return await verify(req, res)
    if (action === "me" && req.method === "GET") return me(req, res)
    if (action === "logout" && req.method === "POST") return logout(res)
    return bad(res, "Not found", 404)
  } catch (e) {
    if (e instanceof HttpError) return bad(res, e.message, e.status)
    throw e
  }
}

function nonce(res: VercelResponse) {
  const n = generateSiweNonce()
  setNonceCookie(res, n)
  return res.status(200).json({ nonce: n })
}

async function verify(req: VercelRequest, res: VercelResponse) {
  const b = (req.body ?? {}) as Record<string, unknown>
  const message = typeof b.message === "string" ? b.message : ""
  const signature = typeof b.signature === "string" ? (b.signature as Hex) : ""
  if (!message || !signature) throw new HttpError(400, "message and signature are required")

  const expectedNonce = readNonce(req)
  if (!expectedNonce) throw new HttpError(401, "Nonce missing or expired — request a new one")

  const { address } = parseSiweMessage(message)
  if (!address) throw new HttpError(400, "message is missing an address")

  const valid = await verifySiweMessage(authClient, {
    message,
    signature,
    nonce: expectedNonce,
    domain: req.headers.host,
    address,
  })
  if (!valid) throw new HttpError(401, "Signature verification failed")

  clearNonceCookie(res)
  setSessionCookie(res, address)
  return res.status(200).json({ address: address.toLowerCase() })
}

function me(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ address: getSession(req)?.address ?? null })
}

function logout(res: VercelResponse) {
  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}
