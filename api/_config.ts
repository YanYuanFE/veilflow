import { HttpError, requireAddress } from "./_http.js"

// Per-type validation of the public `config` blob at creation. Returns a CLEAN
// object containing only the known fields for that type — unknown keys are
// dropped, so the convenience layer can't be stuffed with arbitrary JSON.
// Mirrors exactly what src/routes/create.tsx submits. NO amounts here (those are
// encrypted client-side); only public schedule/shape params.

type Json = Record<string, unknown>

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v)

function nonNegInt(v: unknown, field: string): number {
  if (!isInt(v) || v < 0) throw new HttpError(400, `config.${field} must be a non-negative integer`)
  return v
}

function bps(v: unknown, field: string): number {
  if (!isInt(v) || v < 0 || v > 10_000) throw new HttpError(400, `config.${field} must be an integer 0-10000`)
  return v
}

function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw new HttpError(400, `config.${field} must be a boolean`)
  return v
}

function decimalsOf(c: Json): number {
  const d = c.decimals
  if (!isInt(d) || d < 0 || d > 36) throw new HttpError(400, "config.decimals must be an integer 0-36")
  return d
}

export function validateConfig(type: string, raw: unknown): Json {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "config must be an object")
  const c = raw as Json
  const decimals = decimalsOf(c)

  if (type === "disperse") {
    const mode = c.mode === "direct" || c.mode === "wallet" || c.mode === "wallet-token-fee" ? c.mode : null
    if (mode === null) throw new HttpError(400, "config.mode must be one of: direct, wallet, wallet-token-fee")
    return { decimals, mode }
  }

  if (type === "airdrop") {
    // startTimestamp null = opens at deploy; endTimestamp required.
    const start = c.startTimestamp === null ? null : (isInt(c.startTimestamp) && c.startTimestamp > 0 ? c.startTimestamp : NaN)
    if (Number.isNaN(start)) throw new HttpError(400, "config.startTimestamp must be a positive integer or null")
    if (!isInt(c.endTimestamp) || c.endTimestamp <= 0) throw new HttpError(400, "config.endTimestamp must be a positive integer")
    const end = c.endTimestamp
    if (start !== null && end <= start) throw new HttpError(400, "config.endTimestamp must be after startTimestamp")
    const canExtendClaimWindow = bool(c.canExtendClaimWindow, "canExtendClaimWindow")
    const admin = requireAddress(c.admin, "config.admin")
    return { decimals, startTimestamp: start, endTimestamp: end, canExtendClaimWindow, admin }
  }

  // vesting — schedule applies to every recipient added later.
  if (!isInt(c.startTimestamp) || c.startTimestamp <= 0) throw new HttpError(400, "config.startTimestamp must be a positive integer")
  if (!isInt(c.endTimestamp) || c.endTimestamp <= 0) throw new HttpError(400, "config.endTimestamp must be a positive integer")
  const start = c.startTimestamp
  const end = c.endTimestamp
  if (end <= start) throw new HttpError(400, "config.endTimestamp must be after startTimestamp")
  const cliffSeconds = nonNegInt(c.cliffSeconds, "cliffSeconds")
  if (cliffSeconds > end - start) throw new HttpError(400, "config.cliffSeconds cannot exceed the vesting duration")
  if (!isInt(c.releaseIntervalSecs) || c.releaseIntervalSecs < 1) throw new HttpError(400, "config.releaseIntervalSecs must be a positive integer")
  if (c.releaseIntervalSecs > end - start) throw new HttpError(400, "config.releaseIntervalSecs cannot exceed the vesting duration")
  const initialUnlockBps = bps(c.initialUnlockBps, "initialUnlockBps")
  const cliffAmountBps = bps(c.cliffAmountBps, "cliffAmountBps")
  // Up-front unlocks can't exceed the whole grant — the rest must have something to vest.
  if (initialUnlockBps + cliffAmountBps > 10_000) {
    throw new HttpError(400, "config.initialUnlockBps + cliffAmountBps cannot exceed 10000 (100%)")
  }
  return {
    decimals,
    startTimestamp: start,
    endTimestamp: end,
    cliffSeconds,
    releaseIntervalSecs: c.releaseIntervalSecs,
    timelockSeconds: nonNegInt(c.timelockSeconds, "timelockSeconds"),
    initialUnlockBps,
    cliffAmountBps,
    isRevocable: bool(c.isRevocable, "isRevocable"),
    // Immutable at deploy: lets recipients split a portion of their vesting to another address.
    splitEnabled: typeof c.splitEnabled === "boolean" ? c.splitEnabled : false,
  }
}
