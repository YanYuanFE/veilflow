import { usePublicClient } from "wagmi"
import type { Hex } from "viem"

/**
 * Wait for a submitted transaction to be mined.
 *
 * TokenOps SDK write hooks (pause, claim, withdraw, disclose, transfer, …) resolve
 * on **submission** — `mutateAsync` returns the tx hash without waiting for the
 * receipt. Call `confirm(hash)` before refetching on-chain state or toasting
 * success, otherwise the UI updates before the change is actually on-chain.
 *
 * (Getters that return an encrypted handle and deploy calls that return an address
 * already parse the receipt, so they don't need this.)
 */
export function useConfirmTx() {
  const publicClient = usePublicClient()
  // Accept a raw hash or a result object that carries one (some SDK writes return
  // `{ hash, … }` instead of a bare hash).
  return async (tx: Hex | { hash: Hex } | null | undefined) => {
    const hash = typeof tx === "string" ? tx : tx?.hash
    if (publicClient && hash) await publicClient.waitForTransactionReceipt({ hash })
  }
}
