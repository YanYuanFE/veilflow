import { useCallback } from "react"
import { useAccount, useChainId, useSignMessage } from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { createSiweMessage } from "viem/siwe"
import { fetchNonce, fetchSession, verifySiwe } from "@/lib/auth"

// On-demand SIWE. Connecting a wallet does NOT sign in — the public/on-chain pages
// (claim, audit, wrap, unwrap) never need a session. ensureSession() is invoked by the
// API layer only when a session-guarded request 401s, and it signs in only if the
// connected wallet isn't already signed in. The session cookie lasts 7 days, so for the
// issuer it's a one-time prompt.
export function useEnsureSession() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { signMessageAsync } = useSignMessage()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    if (!address) throw new Error("Connect a wallet to continue")
    const current = await fetchSession()
    if (current === address.toLowerCase()) return // already signed in as this wallet

    const nonce = await fetchNonce()
    const message = createSiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to VeilFlow to manage your distributions.",
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce,
    })
    const signature = await signMessageAsync({ message })
    await verifySiwe(message, signature)
    // Refresh the issuer's own back-office reads now that the session exists.
    queryClient.invalidateQueries({ queryKey: ["distributions"] })
  }, [address, chainId, signMessageAsync, queryClient])
}
