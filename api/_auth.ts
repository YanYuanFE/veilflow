import crypto from "node:crypto"
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { createPublicClient, http } from "viem"
import { sepolia } from "viem/chains"
import { HttpError } from "./_http"

// SIWE session layer. A successful sign-in mints a stateless HMAC-signed token
// stored in an httpOnly cookie, so every serverless function can authenticate a
// request without a DB round-trip. The chain stays the source of truth for money;
// this only proves the caller controls a given wallet so we can scope CMS writes.

const SECRET = process.env.AUTH_SECRET
if (!SECRET) throw new Error("AUTH_SECRET is not set")

const SESSION_COOKIE = "vf_session"
const NONCE_COOKIE = "vf_nonce"
const SESSION_TTL_S = 7 * 24 * 60 * 60 // 7 days
const NONCE_TTL_S = 10 * 60 // 10 minutes
const isProd = process.env.NODE_ENV === "production"

// Public client for verifySiweMessage — only hits the network for smart-contract
// (EIP-1271/6492) signatures; EOA signatures verify locally.
export const authClient = createPublicClient({
  chain: sepolia,
  transport: http("https://sepolia.gateway.tenderly.co"),
})

function hmac(body: string): string {
  return crypto.createHmac("sha256", SECRET!).update(body).digest("base64url")
}

function signSession(address: string): string {
  const payload = { sub: address.toLowerCase(), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${body}.${hmac(body)}`
}

function verifyToken(token: string): { address: string } | null {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const body = token.slice(0, dot)
  const expected = hmac(body)
  const got = Buffer.from(token.slice(dot + 1))
  const want = Buffer.from(expected)
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null
  let payload: { sub?: unknown; exp?: unknown }
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    return null
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  return { address: payload.sub }
}

function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(";")) {
    const i = part.indexOf("=")
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function appendCookie(res: VercelResponse, cookie: string) {
  const prev = res.getHeader("Set-Cookie")
  const list = Array.isArray(prev) ? prev.map(String) : prev ? [String(prev)] : []
  res.setHeader("Set-Cookie", [...list, cookie])
}

function cookie(name: string, value: string, maxAgeS: number): string {
  const attrs = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeS}`]
  if (isProd) attrs.push("Secure")
  return attrs.join("; ")
}

export function setNonceCookie(res: VercelResponse, nonce: string) {
  appendCookie(res, cookie(NONCE_COOKIE, nonce, NONCE_TTL_S))
}
export function readNonce(req: VercelRequest): string | undefined {
  return parseCookies(req)[NONCE_COOKIE]
}
export function clearNonceCookie(res: VercelResponse) {
  appendCookie(res, cookie(NONCE_COOKIE, "", 0))
}

export function setSessionCookie(res: VercelResponse, address: string) {
  appendCookie(res, cookie(SESSION_COOKIE, signSession(address), SESSION_TTL_S))
}
export function clearSessionCookie(res: VercelResponse) {
  appendCookie(res, cookie(SESSION_COOKIE, "", 0))
}

/** Lowercased authenticated address, or null when no valid session cookie. */
export function getSession(req: VercelRequest): { address: string } | null {
  const token = parseCookies(req)[SESSION_COOKIE]
  return token ? verifyToken(token) : null
}

/** Lowercased authenticated address, or throw 401. */
export function requireSession(req: VercelRequest): string {
  const session = getSession(req)
  if (!session) throw new HttpError(401, "Sign in required")
  return session.address
}
