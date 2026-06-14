import { useState } from "react"
import { formatUnits, type Address } from "viem"
import { useAccount } from "wagmi"
import { useConfidentialBalance } from "@zama-fhe/react-sdk"
import { Button } from "@/components/ui/button"
import { Redaction } from "@/components/ui/redaction"
import { Kicker } from "@/components/editorial"

/**
 * Reveals the issuer's confidential balance on demand (sealed → lifts).
 * Pass `compareTo` (e.g. the funding amount / batch total) to surface a
 * shortfall warning once revealed — catches "claims fail, under-funded".
 */
export function BalanceLine({
  token,
  decimals,
  label = "Your confidential balance",
  compareTo,
}: {
  token: Address
  decimals: number
  label?: string
  compareTo?: bigint
}) {
  const { isConnected } = useAccount()
  const [reveal, setReveal] = useState(false)
  const bal = useConfidentialBalance({ tokenAddress: token }, { enabled: isConnected && reveal })
  const value = reveal && bal.data != null ? bal.data : undefined
  const short = value != null && compareTo != null && compareTo > 0n && value < compareTo

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-muted/20 px-3 py-2">
        <Kicker className="tracking-[0.12em]">{label}</Kicker>
        <div className="flex items-center gap-2">
          <Redaction
            revealed={value != null}
            loading={reveal && bal.isLoading}
            chars={9}
            align="end"
            className="font-mono text-sm text-foreground"
          >
            {value != null ? formatUnits(value, decimals) : undefined}
          </Redaction>
          {!reveal && (
            <Button size="xs" variant="ghost" type="button" onClick={() => setReveal(true)} disabled={!isConnected}>
              Reveal
            </Button>
          )}
        </div>
      </div>
      {short && <p className="text-xs text-destructive">Balance is below this amount — top up first, or it will fail on-chain.</p>}
    </div>
  )
}
