import { useEffect, useState, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useUserDecrypt } from "@zama-fhe/react-sdk"
import { useGetClaimAmount, useClaim } from "@tokenops/sdk/fhe-airdrop/react"
import {
  useRecipientVestings,
  useManagerFeeInfo,
  useGetClaimableAmount,
  useClaim as useVestingClaim,
} from "@tokenops/sdk/fhe-vesting/react"
import { FeeType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { getDistributionBySlug, listRecipients, type Distribution } from "@/lib/api"
import { useTokenMeta } from "@/lib/tokens"
import { shortAddr, fmtTime } from "@/lib/format"

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function fmtCountdown(secs: number): string {
  if (secs <= 0) return "0s"
  const d = Math.floor(secs / 86_400)
  const h = Math.floor((secs % 86_400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h || d) parts.push(`${h}h`)
  parts.push(`${m}m`, `${s}s`)
  return parts.join(" ")
}

export function Claim() {
  const { slug } = useParams<{ slug: string }>()
  const { isConnected } = useAccount()

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  const distQ = useQuery({
    queryKey: ["claim-distribution", slug],
    queryFn: () => getDistributionBySlug(slug!),
    enabled: !!slug,
  })
  const d = distQ.data
  const meta = useTokenMeta(d?.token as Address | undefined)

  if (distQ.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (distQ.error) return <p className="text-sm text-destructive">{distQ.error.message}</p>
  if (!d) return null

  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const start = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const end = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const notStarted = start != null && now < start
  const ended = end != null && now > end
  const supported = d.type === "airdrop" || d.type === "vesting"
  // Airdrop's window closes claiming; vesting stays claimable after the end (fully vested).
  const airdropBlocked = d.type === "airdrop" && (notStarted || ended)

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
          <StatusBadge status={d.status} />
        </div>
        <p className="text-muted-foreground">A confidential token claim. Only you can see your own amount.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your claim</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Token">
              {meta.symbol ? (
                <>
                  🔒 {meta.symbol}
                  {meta.name ? <span className="text-muted-foreground"> · {meta.name}</span> : null}
                </>
              ) : (
                <span className="font-mono text-xs">{shortAddr(d.token)}</span>
              )}
            </Info>
            <Info label={d.type === "vesting" ? "Vesting starts" : "Opens"}>{start ? fmtTime(start) : "At deploy"}</Info>
            <Info label={d.type === "vesting" ? "Vesting ends" : "Closes"}>{end ? fmtTime(end) : "—"}</Info>
            <Info label={d.type === "vesting" ? "Manager" : "Pool"}>
              <span className="font-mono text-xs">{shortAddr(d.contractAddress)}</span>
            </Info>
          </div>

          {!supported ? (
            <Banner>Claiming for {d.type} distributions isn't available yet.</Banner>
          ) : !d.contractAddress ? (
            <Banner>This distribution isn't live yet — check back later.</Banner>
          ) : airdropBlocked ? (
            notStarted ? (
              <Banner tone="amber">
                <div className="text-muted-foreground">Claim opens in</div>
                <div className="font-mono text-lg">{fmtCountdown(start! - now)}</div>
              </Banner>
            ) : (
              <Banner tone="muted">Claim window closed ({fmtTime(end)}).</Banner>
            )
          ) : !isConnected ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Connect the wallet that was allocated tokens.</p>
              <ConnectButton />
            </div>
          ) : d.type === "airdrop" ? (
            <AirdropClaimPanel d={d} decimals={decimals} symbol={meta.symbol} closesIn={end != null ? end - now : null} />
          ) : (
            <VestingClaimPanel d={d} decimals={decimals} symbol={meta.symbol} startsIn={notStarted ? start! - now : null} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AirdropClaimPanel({
  d,
  decimals,
  symbol,
  closesIn,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  closesIn: number | null
}) {
  const { address } = useAccount()
  const airdrop = d.contractAddress as Address
  const artifactQ = useQuery({
    queryKey: ["claim-artifact", d.id, address],
    queryFn: () => listRecipients(d.id, address!),
    enabled: !!address,
  })
  const artifact = artifactQ.data?.[0]
  const encryptedInput = artifact
    ? { handle: artifact.handle as Hex, inputProof: artifact.inputProof as Hex }
    : undefined

  const getAmount = useGetClaimAmount({ address: airdrop })
  const claim = useClaim({ address: airdrop })
  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle ? [{ handle: viewHandle, contractAddress: airdrop }] : [] },
    { enabled: !!viewHandle },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined

  const onReveal = async () => {
    if (!encryptedInput || !artifact?.signature) return
    try {
      const view = await getAmount.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      setViewHandle(view.handle)
      toast.success("Access granted — decrypting your amount")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onClaim = async () => {
    if (!encryptedInput || !artifact?.signature) return
    try {
      await claim.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      toast.success("Claimed into your confidential balance")
    } catch (e) {
      toast.error(err(e))
    }
  }

  if (artifactQ.isLoading) return <p className="text-sm text-muted-foreground">Checking your allocation…</p>
  if (!artifact)
    return (
      <Banner>
        No allocation found for <span className="font-mono">{shortAddr(address)}</span> in this distribution.
      </Banner>
    )

  return (
    <div className="space-y-3">
      {closesIn != null && <p className="text-xs text-muted-foreground">Window open · closes in {fmtCountdown(closesIn)}</p>}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={onReveal} disabled={getAmount.isPending}>
          {getAmount.isPending ? "Granting access…" : "Reveal my amount"}
        </Button>
        <Button onClick={onClaim} disabled={claim.isPending}>
          {claim.isPending ? "Claiming…" : claim.isSuccess ? "Claimed ✓" : "Claim tokens"}
        </Button>
      </div>
      {typeof revealed === "bigint" && <RevealedAmount value={revealed} decimals={decimals} symbol={symbol} />}
      {claim.isSuccess && <ClaimedNote />}
    </div>
  )
}

function VestingClaimPanel({
  d,
  decimals,
  symbol,
  startsIn,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  startsIn: number | null
}) {
  const { address } = useAccount()
  const manager = d.contractAddress as Address
  const vestingsQ = useRecipientVestings({ address: manager, recipient: address })
  const feeInfo = useManagerFeeInfo({ address: manager })
  const ids = vestingsQ.data ?? []

  if (vestingsQ.isLoading) return <p className="text-sm text-muted-foreground">Checking your vesting…</p>
  if (ids.length === 0)
    return (
      <Banner>
        No vesting found for <span className="font-mono">{shortAddr(address)}</span> in this distribution.
      </Banner>
    )

  return (
    <div className="space-y-3">
      {startsIn != null ? (
        <p className="text-xs text-muted-foreground">Vesting starts in {fmtCountdown(startsIn)} — little or nothing is claimable yet.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Claim the portion vested so far; come back as more unlocks.</p>
      )}
      {ids.map((id, i) => (
        <VestingClaimItem
          key={id}
          manager={manager}
          vestingId={id}
          fee={feeInfo.data}
          decimals={decimals}
          symbol={symbol}
          index={ids.length > 1 ? i + 1 : undefined}
        />
      ))}
    </div>
  )
}

function VestingClaimItem({
  manager,
  vestingId,
  fee,
  decimals,
  symbol,
  index,
}: {
  manager: Address
  vestingId: Hex
  fee?: { feeType: FeeType; fee: bigint }
  decimals: number
  symbol?: string
  index?: number
}) {
  const getClaimable = useGetClaimableAmount({ address: manager })
  const claim = useVestingClaim({ address: manager })
  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle ? [{ handle: viewHandle, contractAddress: manager }] : [] },
    { enabled: !!viewHandle },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined

  const onReveal = async () => {
    try {
      const view = await getClaimable.mutateAsync({ vestingId })
      setViewHandle(view.handle)
      toast.success("Decrypting your claimable amount")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onClaim = async () => {
    if (!fee) return
    try {
      await claim.mutateAsync(
        fee.feeType === FeeType.Gas
          ? { vestingId, feeType: fee.feeType, value: fee.fee }
          : { vestingId, feeType: fee.feeType },
      )
      toast.success("Claimed your vested tokens")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      {index && (
        <div className="text-xs text-muted-foreground">
          Vesting #{index} · <span className="font-mono">{shortAddr(vestingId)}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={onReveal} disabled={getClaimable.isPending}>
          {getClaimable.isPending ? "Granting access…" : "Reveal claimable"}
        </Button>
        <Button size="sm" onClick={onClaim} disabled={claim.isPending || !fee}>
          {claim.isPending ? "Claiming…" : claim.isSuccess ? "Claimed ✓" : "Claim vested"}
        </Button>
      </div>
      {typeof revealed === "bigint" && <RevealedAmount value={revealed} decimals={decimals} symbol={symbol} label="Claimable now" />}
      {claim.isSuccess && <ClaimedNote />}
    </div>
  )
}

function RevealedAmount({ value, decimals, symbol, label = "Your allocation" }: { value: bigint; decimals: number; symbol?: string; label?: string }) {
  return (
    <div className="rounded-md border p-3 text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono">
        {formatUnits(value, decimals)} {symbol ?? ""}
      </span>
    </div>
  )
}

function ClaimedNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Claimed into your confidential balance. Decrypt it on the{" "}
      <a className="underline" href="/wrap">
        token page
      </a>
      .
    </p>
  )
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function Banner({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "amber" | "muted" }) {
  const cls = tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : tone === "muted" ? "bg-muted/50" : "bg-muted/30"
  return <div className={`space-y-1 rounded-md border p-4 text-sm ${cls}`}>{children}</div>
}
