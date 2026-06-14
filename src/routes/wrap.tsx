import { useState } from "react"
import { isAddress, parseUnits, formatUnits, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useShield, useConfidentialBalance, useIsWrapper } from "@zama-fhe/react-sdk"
import { useTokenDecimals, useUnderlyingToken } from "@/lib/tokens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Redaction } from "@/components/ui/redaction"
import { Kicker } from "@/components/editorial"

const ZERO = "0x0000000000000000000000000000000000000000" as Address

export function Wrap() {
  const { isConnected } = useAccount()
  const [token, setToken] = useState("")
  const [amount, setAmount] = useState("")
  const [reveal, setReveal] = useState(false)

  const valid = isAddress(token)
  const tokenAddress = (valid ? (token as Address) : ZERO)

  // Validate it's actually a confidential ERC-7984 wrapper before touching it —
  // otherwise underlying()/shield revert with a cryptic RPC error.
  const wrapperCheck = useIsWrapper(tokenAddress, { enabled: valid })
  const isWrapper = wrapperCheck.data === true

  // Balance is in the confidential token's decimals; the shield deposit is in
  // the underlying ERC-20's decimals (can differ, e.g. WETH 18 → cWETH 6).
  const confidentialDecimals = useTokenDecimals(valid && isWrapper ? tokenAddress : undefined)
  const underlyingToken = useUnderlyingToken(valid && isWrapper ? tokenAddress : undefined)
  const underlyingDecimals = useTokenDecimals(underlyingToken)
  const balance = useConfidentialBalance(
    { tokenAddress },
    { enabled: valid && isWrapper && isConnected && reveal },
  )
  const shield = useShield({ tokenAddress })
  const revealedNum = reveal && balance.data != null && confidentialDecimals !== undefined

  const onWrap = async () => {
    if (!valid || !amount || underlyingDecimals === undefined) return
    try {
      await shield.mutateAsync({ amount: parseUnits(amount, underlyingDecimals) })
      setAmount("")
      toast.success("Wrapped into confidential balance")
      if (reveal) await balance.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-2">
        <Kicker>Treasury · Wrap</Kicker>
        <h1 className="font-display text-[clamp(2rem,4.5vw,2.85rem)] leading-tight text-foreground">Wrap</h1>
        <p className="font-serif text-[1.0625rem] leading-relaxed text-muted-foreground">
          Shield a public ERC-20 into its confidential ERC-7984 token. Amounts become encrypted on-chain.
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
              Not a confidential ERC-7984 wrapper. Paste the confidential token address (e.g. cUSDT 0x4E7B…4491), not the
              underlying ERC-20.
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
                {revealedNum ? formatUnits(balance.data!, confidentialDecimals!) : undefined}
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
          <Label htmlFor="amount">Amount to wrap</Label>
          <Input id="amount" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <Button
          onClick={onWrap}
          disabled={!isConnected || !valid || !isWrapper || !amount || underlyingDecimals === undefined || shield.isPending}
        >
          {shield.isPending ? "Wrapping…" : "Wrap"}
        </Button>
        {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to wrap.</p>}
        {shield.error && <p className="text-sm text-destructive">{shield.error.message}</p>}
      </div>
    </div>
  )
}
