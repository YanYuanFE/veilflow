import type { Address, Hex } from "viem"
import type { Distribution } from "@/lib/api"

// Sepolia deployment addresses (TokenOps SDK).
export const FACTORY_SEPOLIA = "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" as Address
export const DISPERSE_SINGLETON = "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4" as Address
export const EXPLORER = "https://sepolia.etherscan.io"

export function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function randomSalt(): Hex {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return ("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")) as Hex
}

export function numberConfig(d: Distribution, key: string, fallback: number): number {
  const v = d.config[key]
  return typeof v === "number" ? v : fallback
}
