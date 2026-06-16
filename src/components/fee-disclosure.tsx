import { type ReactNode } from "react"
import { formatEther, type Address } from "viem"
import {
  useFactoryCustomFee as useAirdropCustomFee,
  useFactoryDefaultGasFee as useAirdropDefaultGasFee,
} from "@tokenops/sdk/fhe-airdrop/react"
import {
  useFactoryCustomFee as useVestingCustomFee,
  useFactoryDefaultFeeType,
  useFactoryDefaultGasFee as useVestingDefaultGasFee,
  useFactoryDefaultTokenFee,
} from "@tokenops/sdk/fhe-vesting/react"
import { FeeType } from "@tokenops/sdk/fhe-vesting"
import { Kicker, Notice } from "@/components/editorial"
import type { DistributionType } from "@/lib/api"

// Read-only disclosure of what RECIPIENTS will pay to claim. The rate is not the
// issuer's to set — it's baked into the clone at deploy from the factory's
// per-creator override (if any) or the factory default. Disperse is omitted: it
// has no claim step and its mode-dependent fee is shown in the panel's preflight.

const Mono = ({ children }: { children: ReactNode }) => <span className="font-mono text-foreground">{children}</span>

function Shell({ children }: { children: ReactNode }) {
  return (
    <Notice tone="muted">
      <Kicker className="tracking-[0.12em]">Claim fee · recipients pay</Kicker>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground">{children}</p>
    </Notice>
  )
}

const source = (overridden: boolean) =>
  overridden ? "A custom rate is set for your address." : "Factory default rate."

function gasSentence(gasFee: bigint, overridden: boolean): ReactNode {
  return gasFee === 0n ? (
    <>No per-claim fee — recipients claim for free. {source(overridden)}</>
  ) : (
    <>
      Each recipient pays <Mono>{formatEther(gasFee)} ETH</Mono> in gas per claim. {source(overridden)}
    </>
  )
}

function tokenSentence(bps: bigint, overridden: boolean): ReactNode {
  return bps === 0n ? (
    <>No per-claim fee — recipients keep 100% of each claim. {source(overridden)}</>
  ) : (
    <>
      A <Mono>{Number(bps) / 100}%</Mono> token fee ({bps.toString()} bps) is deducted from each claim. {source(overridden)}
    </>
  )
}

function AirdropFeeNote({ creator }: { creator: Address }) {
  const custom = useAirdropCustomFee({ creator })
  const def = useAirdropDefaultGasFee()
  if (custom.error || def.error) return <Shell>Current fee schedule unavailable on this network.</Shell>
  if (!custom.data || def.data === undefined) return <Shell>Reading the current fee schedule…</Shell>
  const overridden = custom.data.enabled
  return <Shell>{gasSentence(overridden ? custom.data.gasFee : def.data, overridden)}</Shell>
}

function VestingFeeNote({ creator }: { creator: Address }) {
  const custom = useVestingCustomFee({ creator })
  const feeType = useFactoryDefaultFeeType()
  const gas = useVestingDefaultGasFee()
  const tokenBps = useFactoryDefaultTokenFee()
  if (custom.error || feeType.error || gas.error || tokenBps.error)
    return <Shell>Current fee schedule unavailable on this network.</Shell>
  if (!custom.data || feeType.data === undefined || gas.data === undefined || tokenBps.data === undefined)
    return <Shell>Reading the current fee schedule…</Shell>
  const overridden = custom.data.enabled
  const effType = overridden ? custom.data.preferredFeeType : feeType.data
  if (effType === FeeType.DistributionToken)
    return <Shell>{tokenSentence(overridden ? custom.data.tokenFee : tokenBps.data, overridden)}</Shell>
  return <Shell>{gasSentence(overridden ? custom.data.gasFee : gas.data, overridden)}</Shell>
}

export function FeeDisclosure({ type, creator }: { type: DistributionType; creator: Address }) {
  if (type === "airdrop") return <AirdropFeeNote creator={creator} />
  if (type === "vesting") return <VestingFeeNote creator={creator} />
  return null
}
