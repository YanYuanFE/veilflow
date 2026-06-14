import { useState } from "react"
import { isAddress, parseUnits, formatUnits, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useUnshield, useConfidentialBalance, useIsWrapper } from "@zama-fhe/react-sdk"
import { useTokenDecimals } from "@/lib/tokens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Redaction } from "@/components/ui/redaction"
import { Kicker } from "@/components/editorial"

const ZERO = "0x0000000000000000000000000000000000000000" as Address

export function Unwrap() {
  const { isConnected } = useAccount()
  const [token, setToken] = useState("")
  const [amount, setAmount] = useState("")
  const [reveal, setReveal] = useState(false)

  const valid = isAddress(token)
  const tokenAddress = (valid ? (token as Address) : ZERO)

  const wrapperCheck = useIsWrapper(tokenAddress, { enabled: valid })
  const isWrapper = wrapperCheck.data === true

  // Unshield burns confidential tokens, so the amount is in the confidential
  // token's decimals — same units as the balance shown below.
  const decimals = useTokenDecimals(valid && isWrapper ? tokenAddress : undefined)
  const balance = useConfidentialBalance(
    { tokenAddress },
    { enabled: valid && isWrapper && isConnected && reveal },
  )
  const unshield = useUnshield({ tokenAddress })
  const revealedNum = reveal && balance.data != null && decimals !== undefined

  const onUnwrap = async () => {
    if (!valid || !amount || decimals === undefined) return
    try {
      await unshield.mutateAsync({ amount: parseUnits(amount, decimals) })
      setAmount("")
      toast.success("Unwrapped to public ERC-20")
      if (reveal) await balance.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-2">
        <Kicker>Treasury · Unwrap</Kicker>
        <h1 className="font-display text-[clamp(2rem,4.5vw,2.85rem)] leading-tight text-foreground">Unwrap</h1>
        <p className="font-serif text-[1.0625rem] leading-relaxed text-muted-foreground">
          Unshield a confidential ERC-7984 token back into its public ERC-20. Runs the unwrap and finalize steps for you.
        </p>
      </header>

      <div className="space-y-5 rounded-md border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="token">Confidential token</Label>
          <Input id="token" placeholder="0x… (ERC-7984 wrapper)" value={token} onChange={(e) => setToken(e.target.value.trim())} />
          {token && !valid && <p className="text-sm text-destructive">Invalid address.</p>}
          {valid && wrapperCheck.isLoading && <p className="text-xs text-muted-foreground">Checking token…</p>}
          {valid && wrapperCheck.data === false && (
            <p className="text-sm text-destructive">
              Not a confidential ERC-7984 wrapper. Paste the confidential token address, not the underlying ERC-20.
            </p>
          )}
          {valid && wrapperCheck.error && <p className="text-sm text-destructive">Couldn't verify token: {wrapperCheck.error.message}</p>}
        </div>

        {valid && isWrapper && (
          <div className="flex items-center justify-between gap-4 rounded-sm border border-border bg-muted/20 px-4 py-3">
            <Kicker className="tracking-[0.12em]">Confidential balance</Kicker>
            <div className="flex items-center gap-3">
              <Redaction
                revealed={!!revealedNum}
                loading={reveal && balance.isLoading}
                chars={9}
                align="end"
                className="font-mono text-foreground"
              >
                {revealedNum ? formatUnits(balance.data!, decimals!) : undefined}
              </Redaction>
              {!reveal && (
                <Button size="sm" variant="outline" disabled={!isConnected} onClick={() => setReveal(true)}>
                  Reveal
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="amount">Amount to unwrap</Label>
          <Input id="amount" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <Button
          onClick={onUnwrap}
          disabled={!isConnected || !valid || !isWrapper || !amount || decimals === undefined || unshield.isPending}
        >
          {unshield.isPending ? "Unwrapping…" : "Unwrap"}
        </Button>
        {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to unwrap.</p>}
        {unshield.error && <p className="text-sm text-destructive">{unshield.error.message}</p>}
      </div>
    </div>
  )
}
