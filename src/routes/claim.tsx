import { useState, type CSSProperties, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Lock, Unlock, ShieldCheck, Eye } from "lucide-react"
import { useUserDecrypt } from "@zama-fhe/react-sdk"
import {
  useGetClaimAmount,
  useClaim,
  useAirdropIsSignatureClaimed,
  useAirdropIsSignatureValid,
  useAirdropIsPaused,
  useAirdropStartTime,
  useAirdropEndTime,
} from "@tokenops/sdk/fhe-airdrop/react"
import {
  useRecipientVestings,
  useManagerFeeInfo,
  useManagerPaused,
  useGetClaimableAmount,
  useClaim as useVestingClaim,
  useVestingInfo,
} from "@tokenops/sdk/fhe-vesting/react"
import { FeeType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Redaction } from "@/components/ui/redaction"
import { StatusBadge } from "@/components/status-badge"
import { VestingActionsDialog, AcceptIncomingTransfer } from "@/components/vesting-actions"
import { VestingTimeline } from "@/components/vesting-timeline"
import { Badge } from "@/components/ui/badge"
import { useRepresentativeSchedule } from "@/lib/vesting-schedule"
import { Kicker, Folio, Notice } from "@/components/editorial"
import { CopyButton } from "@/components/copy-button"
import { Loading } from "@/components/spinner"
import { getDistributionBySlug, listRecipients, type Distribution } from "@/lib/api"
import { useTokenMeta } from "@/lib/tokens"
import { useConfirmTx } from "@/lib/use-confirm-tx"
import { useNowSeconds } from "@/lib/use-now"
import { shortAddr, fmtTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { parseTheme, readableInk, type DistributionTheme } from "@/lib/theme"
import "./claim.css"

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

function fmtRange(start: number | null, end: number | null): string {
  const f = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  if (start && end) return `${f(start)} – ${f(end)}`
  if (end) return `until ${f(end)}`
  if (start) return `from ${f(start)}`
  return ""
}

export function Claim() {
  const { slug } = useParams<{ slug: string }>()
  const { isConnected } = useAccount()

  const now = useNowSeconds()

  const distQ = useQuery({
    queryKey: ["claim-distribution", slug],
    queryFn: () => getDistributionBySlug(slug!),
    enabled: !!slug,
  })
  const d = distQ.data
  const meta = useTokenMeta(d?.token as Address | undefined)

  if (distQ.isLoading)
    return (
      <ClaimFrame>
        <Loading label="Loading the statement…" className="mx-auto max-w-2xl" />
      </ClaimFrame>
    )
  if (distQ.error)
    return (
      <ClaimFrame>
        <Notice tone="void">{distQ.error.message}</Notice>
      </ClaimFrame>
    )
  if (!d) return null

  const theme = parseTheme(d.theme)
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const start = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const notStarted = start != null && now < start
  const supported = d.type === "airdrop" || d.type === "vesting"

  return (
    <ClaimFrame theme={theme} brandName={d.name}>
      <div className="space-y-10">
        <header className="claim-reveal space-y-4 text-center">
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            <Kicker>Confidential claim · {d.type}</Kicker>
          </span>
          <h1 className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-tight text-foreground">
            {theme.title ?? d.name}
          </h1>
          <p className="mx-auto max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
            {theme.description ?? "Only you can read your own figure. It stays sealed until you decrypt it with your wallet."}
          </p>
        </header>

        <div
          className="claim-card claim-reveal mx-auto max-w-2xl overflow-hidden rounded-[6px] border border-border bg-card"
          style={{ animationDelay: "0.12s" }}
        >
          {/* Header meta + token symbol + claim action */}
          <div className="px-6 py-8 text-center sm:px-8 sm:py-10">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <HeaderDateRange d={d} />
              <StatusBadge status={d.status} />
            </div>
            <div className="mt-7">
            {d.type === "disperse" ? (
              <div className="space-y-2">
                <Kicker>Direct distribution</Kicker>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Disperse sends tokens directly — there's nothing to claim here. Read your confidential balance on the{" "}
                  <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href="/wrap">
                    token page
                  </a>
                  .
                </p>
              </div>
            ) : !supported ? (
              <p className="text-sm text-muted-foreground">Claiming for {d.type} distributions isn't available yet.</p>
            ) : !d.contractAddress ? (
              <div className="space-y-2">
                <Kicker>Not live yet</Kicker>
                <p className="text-sm text-muted-foreground">This distribution isn't live yet — check back later.</p>
              </div>
            ) : d.type === "airdrop" ? (
              <AirdropClaimSection d={d} decimals={decimals} symbol={meta.symbol} isConnected={isConnected} now={now} />
            ) : !isConnected ? (
              <ConnectPrompt />
            ) : (
              <VestingClaimPanel d={d} decimals={decimals} symbol={meta.symbol} startsIn={notStarted ? start! - now : null} theme={theme} />
            )}
            </div>
            <p className="mt-7 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3 shrink-0" aria-hidden />
              Encrypted on-chain — only your wallet can decrypt it.
            </p>
          </div>

          {/* Vesting unlock schedule — public shape from the on-chain representative vesting */}
          {d.type === "vesting" && d.contractAddress && <PublicVestingTimeline manager={d.contractAddress as Address} d={d} />}
        </div>
      </div>
    </ClaimFrame>
  )
}

/** Standalone, branded shell for the customer-facing claim page (no app chrome). */
function ClaimFrame({ theme, brandName, children }: { theme?: DistributionTheme; brandName?: string; children: ReactNode }) {
  const accent = theme?.accent
  // Map the distribution's accent onto both --primary and RainbowKit's accent
  // vars, so the Connect Wallet button matches the configured theme color.
  const style = accent
    ? ({
        "--primary": accent,
        "--primary-foreground": readableInk(accent),
        "--rk-colors-accentColor": accent,
        "--rk-colors-accentColorForeground": readableInk(accent),
      } as CSSProperties)
    : undefined
  return (
    <div className={cn("claim-page flex min-h-svh flex-col bg-background text-foreground", theme?.mode === "dark" && "dark")} style={style}>
      <div className="h-[2px] w-full bg-primary" />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3.5">
          <BrandMark theme={theme} brandName={brandName} />
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12 sm:py-16">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-5">
          <Kicker>Confidential claim · sealed end-to-end</Kicker>
          <a
            href="/"
            className="text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Powered by Veilflow
          </a>
        </div>
      </footer>
    </div>
  )
}

function BrandMark({ theme, brandName }: { theme?: DistributionTheme; brandName?: string }) {
  if (theme?.logoUrl)
    return <img src={theme.logoUrl} alt={brandName ?? "Logo"} className="h-7 max-w-[180px] object-contain" />
  return <span className="font-display text-xl leading-none tracking-tight text-foreground">{brandName ?? "Veilflow"}</span>
}

function ConnectPrompt() {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Kicker>Secure access</Kicker>
        <p className="mx-auto max-w-[36ch] text-sm leading-relaxed text-muted-foreground">
          Connect the wallet that was allocated tokens to decrypt your figure.
        </p>
      </div>
      <div className="flex justify-center">
        <ConnectButton />
      </div>
    </div>
  )
}

// Card-header date range. Airdrop windows can be extended on-chain, so read the live end
// there; vesting/disperse use the create-time config.
function HeaderDateRange({ d }: { d: Distribution }) {
  if (d.type === "airdrop" && d.contractAddress)
    return <AirdropHeaderRange airdrop={d.contractAddress as Address} d={d} />
  const start = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const end = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  if (!start && !end) return null
  return <span className="font-mono text-sm text-muted-foreground">{fmtRange(start, end)}</span>
}

function AirdropHeaderRange({ airdrop, d }: { airdrop: Address; d: Distribution }) {
  const startQ = useAirdropStartTime({ address: airdrop })
  const endQ = useAirdropEndTime({ address: airdrop })
  const start = startQ.data ?? (typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null)
  const end = endQ.data ?? (typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null)
  if (!start && !end) return null
  return <span className="font-mono text-sm text-muted-foreground">{fmtRange(start, end)}</span>
}

// Airdrop claim window, read on-chain. The admin can extend the window after deploy
// (useExtendClaimWindow), so the DB end time can be stale — the chain is authoritative for
// "opens in / window closed / closes in". DB config covers the brief read latency.
function AirdropClaimSection({
  d,
  decimals,
  symbol,
  isConnected,
  now,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  isConnected: boolean
  now: number
}) {
  const airdrop = d.contractAddress as Address
  const startQ = useAirdropStartTime({ address: airdrop })
  const endQ = useAirdropEndTime({ address: airdrop })
  const start = startQ.data ?? (typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null)
  const end = endQ.data ?? (typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null)

  if (start != null && now < start)
    return (
      <div className="space-y-2">
        <Kicker>Claim opens in</Kicker>
        <div className="font-mono text-[clamp(1.75rem,6vw,2.5rem)] leading-none tabular-nums text-foreground">
          {fmtCountdown(start - now)}
        </div>
      </div>
    )
  if (end != null && now > end)
    return (
      <div className="space-y-2">
        <Kicker>Claim window closed</Kicker>
        <p className="text-sm text-muted-foreground">{fmtTime(end)}</p>
      </div>
    )
  return (
    <AirdropClaimGate d={d} decimals={decimals} symbol={symbol} closesIn={end != null ? end - now : null} isConnected={isConnected} />
  )
}

/** Airdrop action area, gated by the contract's pause state (read even before
 *  connecting), then by wallet connection. */
function AirdropClaimGate({
  d,
  decimals,
  symbol,
  closesIn,
  isConnected,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  closesIn: number | null
  isConnected: boolean
}) {
  const paused = useAirdropIsPaused({ address: d.contractAddress as Address }).data === true
  if (paused)
    return (
      <div className="space-y-2">
        <Kicker>Claims paused</Kicker>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The issuer has paused claims for now. Your allocation is safe — check back later.
        </p>
      </div>
    )
  if (!isConnected) return <ConnectPrompt />
  return <AirdropClaimPanel d={d} decimals={decimals} symbol={symbol} closesIn={closesIn} />
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
  const confirm = useConfirmTx()
  const [confirming, setConfirming] = useState(false)
  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle ? [{ handle: viewHandle, contractAddress: airdrop }] : [] },
    { enabled: !!viewHandle },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined
  const revealedNum = typeof revealed === "bigint"
  const revealing = getAmount.isPending || (!!viewHandle && revealed === undefined && !decrypt.error)

  // Single-use — read claimed state from the contract. The claim consumes the
  // (user, encrypted-amount handle) signature, so this flips true on-chain.
  const claimedQ = useAirdropIsSignatureClaimed({
    address: airdrop,
    user: address,
    encryptedAmountHandle: artifact?.handle as Hex | undefined,
  })
  const isClaimed = claim.isSuccess || claimedQ.data === true

  // On-chain pre-check: the admin signature is bound to (caller, handle), so an
  // allocation signed for a different wallet is invalid for the connected one.
  // Surface that before the claim reverts.
  const sigValidQ = useAirdropIsSignatureValid({
    address: airdrop,
    encryptedAmountHandle: artifact?.handle as Hex | undefined,
    signature: artifact?.signature as Hex | undefined,
    caller: address,
  })
  const sigInvalid = sigValidQ.data === false

  const onReveal = async () => {
    if (!encryptedInput || !artifact?.signature) return
    try {
      const view = await getAmount.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      setViewHandle(view.handle)
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onClaim = async () => {
    if (!encryptedInput || !artifact?.signature) return
    setConfirming(true)
    try {
      const hash = await claim.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      await confirm(hash)
      await claimedQ.refetch() // re-read on-chain claimed state once the tx is mined
      toast.success("Claimed into your confidential balance")
    } catch (e) {
      toast.error(err(e))
    } finally {
      setConfirming(false)
    }
  }

  if (artifactQ.isLoading) return <Kicker>Checking your allocation…</Kicker>
  if (!artifact)
    return (
      <Notice tone="muted">
        No allocation found for <span className="font-mono text-foreground">{shortAddr(address)}</span> here.
      </Notice>
    )

  return (
    <div className="space-y-5">
      <AllocationRow
        label="Your allocation"
        revealed={revealedNum}
        loading={revealing}
        decimals={decimals}
        value={revealed}
        symbol={symbol}
      />
      {closesIn != null && <Kicker>Window open · closes in {fmtCountdown(closesIn)}</Kicker>}
      {sigInvalid && (
        <Notice tone="void">
          This allocation was authorized for a different wallet — connect the address that was allocated tokens to claim.
        </Notice>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!revealedNum && (
          <Button variant="outline" onClick={onReveal} disabled={revealing}>
            <Eye />
            {revealing ? "Lifting the veil…" : "Decrypt my amount"}
          </Button>
        )}
        <Button onClick={onClaim} disabled={confirming || isClaimed || sigInvalid}>
          {confirming ? (claim.isPending ? "Claiming…" : "Confirming…") : isClaimed ? "Claimed ✓" : "Claim tokens"}
        </Button>
      </div>
      {isClaimed && !confirming && <ClaimedNote />}
    </div>
  )
}

function VestingClaimPanel({
  d,
  decimals,
  symbol,
  startsIn,
  theme,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  startsIn: number | null
  theme?: DistributionTheme
}) {
  const { address } = useAccount()
  const manager = d.contractAddress as Address
  const vestingsQ = useRecipientVestings({ address: manager, recipient: address })
  const feeInfo = useManagerFeeInfo({ address: manager })
  const paused = useManagerPaused({ address: manager }).data === true
  const ids = vestingsQ.data ?? []

  if (vestingsQ.isLoading) return <Kicker>Checking your vesting…</Kicker>
  if (paused)
    return (
      <div className="space-y-2">
        <Kicker>Claims paused</Kicker>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The issuer has paused this vesting for now. Your allocation is safe — check back later.
        </p>
      </div>
    )
  if (ids.length === 0)
    return (
      <Notice tone="muted">
        No vesting found for <span className="font-mono text-foreground">{shortAddr(address)}</span> here.
      </Notice>
    )

  return (
    <div className="space-y-4">
      <Kicker>
        {startsIn != null
          ? `Vesting starts in ${fmtCountdown(startsIn)} — little is claimable yet`
          : "Claim what's vested so far; return as more unlocks"}
      </Kicker>
      <div className="space-y-3">
        {ids.map((id, i) => (
          <VestingClaimItem
            key={id}
            manager={manager}
            vestingId={id}
            fee={feeInfo.data}
            decimals={decimals}
            symbol={symbol}
            index={ids.length > 1 ? i + 1 : undefined}
            distributionId={d.id}
            self={address}
            theme={theme}
          />
        ))}
      </div>
      <AcceptIncomingTransfer manager={manager} />
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
  distributionId,
  self,
  theme,
}: {
  manager: Address
  vestingId: Hex
  fee?: { feeType: FeeType; fee: bigint }
  decimals: number
  symbol?: string
  index?: number
  distributionId?: string
  self?: Address
  theme?: DistributionTheme
}) {
  const getClaimable = useGetClaimableAmount({ address: manager })
  const claim = useVestingClaim({ address: manager })
  const confirm = useConfirmTx()
  const infoQ = useVestingInfo({ address: manager, vestingId })
  const revoked = (infoQ.data?.revokeTimestamp ?? 0) > 0
  const [confirming, setConfirming] = useState(false)
  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle ? [{ handle: viewHandle, contractAddress: manager }] : [] },
    { enabled: !!viewHandle },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined
  const revealedNum = typeof revealed === "bigint"
  const revealing = getClaimable.isPending || (!!viewHandle && revealed === undefined && !decrypt.error)

  // Vesting amounts are confidential — there's no plaintext "claimed" flag on-chain.
  // The honest signal is the claimable amount itself: decrypted to 0 means the
  // vested-so-far portion is already claimed (or nothing has vested yet).
  const revealedZero = revealedNum && revealed === 0n

  const onReveal = async () => {
    try {
      const view = await getClaimable.mutateAsync({ vestingId })
      setViewHandle(view.handle)
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onClaim = async () => {
    if (!fee) return
    setConfirming(true)
    try {
      const hash = await claim.mutateAsync(
        fee.feeType === FeeType.Gas
          ? { vestingId, feeType: fee.feeType, value: fee.fee }
          : { vestingId, feeType: fee.feeType },
      )
      await confirm(hash)
      setViewHandle(undefined) // the prior reveal is now spent — re-seal so it can be re-read
      toast.success("Claimed your vested tokens")
    } catch (e) {
      toast.error(err(e))
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className={cn("space-y-4", index && "rounded-md border border-border p-4")}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <Kicker>{index ? `Vesting № ${index}` : "Vesting id"}</Kicker>
          {revoked && <Badge variant="destructive">Revoked</Badge>}
        </span>
        <span className="inline-flex items-center gap-0.5">
          <Folio>{shortAddr(vestingId)}</Folio>
          <CopyButton value={vestingId} title="Copy vesting id" />
        </span>
      </div>
      <AllocationRow
        label="Claimable now"
        revealed={revealedNum}
        loading={revealing}
        decimals={decimals}
        value={revealed}
        symbol={symbol}
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!revealedNum && (
          <Button variant="outline" onClick={onReveal} disabled={revealing}>
            <Eye />
            {revealing ? "Lifting the veil…" : "Decrypt claimable"}
          </Button>
        )}
        <Button onClick={onClaim} disabled={confirming || !fee || claim.isSuccess || revealedZero}>
          {confirming ? (claim.isPending ? "Claiming…" : "Confirming…") : claim.isSuccess ? "Claimed ✓" : "Claim vested"}
        </Button>
        <VestingActionsDialog
          manager={manager}
          vestingId={vestingId}
          fee={fee}
          decimals={decimals}
          distributionId={distributionId}
          self={self}
          theme={theme}
        />
      </div>
      {claim.isSuccess && !confirming ? (
        <ClaimedNote />
      ) : (
        revealedZero && (
          <p className="text-sm text-muted-foreground">Nothing claimable right now — return as more unlocks.</p>
        )
      )}
    </div>
  )
}

/** A labeled confidential figure — sealed in a framed block (Lock + redacted
 *  bar) until the holder decrypts it, then the bar lifts to reveal the number. */
function AllocationRow({
  label,
  revealed,
  loading,
  value,
  decimals,
  symbol,
}: {
  label: string
  revealed: boolean
  loading: boolean
  value: unknown
  decimals: number
  symbol?: string
}) {
  // Redact only the figure; the token symbol sits to its right as a visible unit.
  const text = revealed && typeof value === "bigint" ? formatUnits(value, decimals) : undefined
  return (
    <div
      className={cn(
        "claim-figure relative overflow-hidden rounded-[6px] border border-border px-5 py-5 text-left sm:px-6",
        revealed ? "bg-card" : "claim-seal-frame bg-muted/25",
      )}
    >
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <span className="inline-flex items-center gap-1.5">
            {revealed ? (
              <Unlock className="size-3 text-primary" aria-hidden />
            ) : (
              <Lock className="size-3 text-muted-foreground" aria-hidden />
            )}
            <Kicker className="tracking-[0.14em]">{label}</Kicker>
          </span>
          <Redaction
            revealed={revealed}
            loading={loading}
            chars={7}
            className="font-mono text-[clamp(1.75rem,6vw,2.75rem)] leading-none font-medium text-foreground"
          >
            {text}
          </Redaction>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {symbol && (
            <span className="font-mono text-lg leading-none font-medium text-foreground sm:text-xl">{symbol}</span>
          )}
          {revealed ? (
            <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold tracking-[0.1em] text-primary uppercase">
              <ShieldCheck className="size-3" aria-hidden />
              Visible to you
            </span>
          ) : (
            <span className="text-[0.625rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
              Encrypted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClaimedNote() {
  return (
    <p className="text-sm text-muted-foreground">
      Claimed into your confidential balance. Decrypt it on the{" "}
      <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href="/wrap">
        token page
      </a>
      .
    </p>
  )
}

// The public unlock curve at the bottom of the claim page — read from the representative vesting
// on-chain (DB fallback while it loads) so it reflects the real on-chain terms.
function PublicVestingTimeline({ manager, d }: { manager: Address; d: Distribution }) {
  const { schedule: s } = useRepresentativeSchedule(manager, d)
  if (!(s.end > s.start)) return null
  return (
    <div className="border-t border-border px-6 py-6 sm:px-8">
      <VestingTimeline
        start={s.start}
        end={s.end}
        cliffSeconds={s.cliffSeconds}
        releaseIntervalSecs={s.releaseIntervalSecs}
        initialUnlockBps={s.initialUnlockBps}
        cliffAmountBps={s.cliffAmountBps}
      />
    </div>
  )
}
