import { useState, type CSSProperties, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Lock, Unlock, ShieldCheck, Eye, SearchX, ExternalLink, Pause, Check } from "lucide-react"
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
import { ChainGate } from "@/components/chain-gate"
import { VestingTimeline } from "@/components/vesting-timeline"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useRepresentativeSchedule } from "@/lib/vesting-schedule"
import { Kicker, Folio, Notice } from "@/components/editorial"
import { CopyButton } from "@/components/copy-button"
import { Loading } from "@/components/spinner"
import { getDistributionBySlug, listRecipients, type Distribution } from "@/lib/api"
import { EXPLORER } from "@/routes/distribution/shared"
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
            {theme.description ?? "Only you can see your allocation — it stays sealed until you decrypt it with your wallet."}
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
            {d.type === "airdrop" && d.contractAddress && (
              <AirdropClosesIn airdrop={d.contractAddress as Address} d={d} now={now} />
            )}
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
          Connect the wallet that was allocated tokens to decrypt your allocation.
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

// Live "closes in" countdown under the header date range — only while the window is open.
// Reads the on-chain end (admin can extend); React Query dedupes with AirdropHeaderRange.
function AirdropClosesIn({ airdrop, d, now }: { airdrop: Address; d: Distribution; now: number }) {
  const startQ = useAirdropStartTime({ address: airdrop })
  const endQ = useAirdropEndTime({ address: airdrop })
  const start = startQ.data ?? (typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null)
  const end = endQ.data ?? (typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null)
  if (start != null && now < start) return null
  if (end == null || now > end) return null
  return (
    <p className="mt-2">
      <Kicker>Closes in {fmtCountdown(end - now)}</Kicker>
    </p>
  )
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
  return <AirdropClaimGate d={d} decimals={decimals} symbol={symbol} isConnected={isConnected} />
}

/** Airdrop action area, gated by the contract's pause state (read even before
 *  connecting), then by wallet connection. */
function AirdropClaimGate({
  d,
  decimals,
  symbol,
  isConnected,
}: {
  d: Distribution
  decimals: number
  symbol?: string
  isConnected: boolean
}) {
  const paused = useAirdropIsPaused({ address: d.contractAddress as Address }).data === true
  if (paused)
    return (
      <PausedState
        title="Claims are paused"
        hint="The issuer has paused claims for now. Your allocation is safe — check back later."
      />
    )
  if (!isConnected) return <ConnectPrompt />
  return <AirdropClaimPanel d={d} decimals={decimals} symbol={symbol} />
}

function AirdropClaimPanel({
  d,
  decimals,
  symbol,
}: {
  d: Distribution
  decimals: number
  symbol?: string
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
  const [result, setResult] = useState<{ amount: bigint; hash: Hex } | null>(null)
  const [showResult, setShowResult] = useState(false)
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
  const isClaimed = claimedQ.data === true

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
    const amount = typeof revealed === "bigint" ? revealed : 0n // the figure they saw, now claimed
    setConfirming(true)
    try {
      const hash = await claim.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      await confirm(hash)
      await claimedQ.refetch() // re-read on-chain claimed state once the tx is mined
      setResult({ amount, hash })
      setShowResult(true)
    } catch (e) {
      toast.error(err(e))
    } finally {
      setConfirming(false)
    }
  }

  if (artifactQ.isLoading) return <Kicker>Checking your allocation…</Kicker>
  if (!artifact)
    return (
      <NotOnList
        title="Not on the allocation list"
        hint="This airdrop has no allocation for the connected wallet. If you were expecting one, switch to the wallet it was sent to."
        address={address}
      />
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
      {/* Single-use signature: it reads invalid both for a wrong wallet AND once
          consumed by a claim. Only the pre-claim case means "wrong wallet". */}
      {sigInvalid && !isClaimed && !result && (
        <Notice tone="void">
          This allocation was authorized for a different wallet — connect the address that was allocated tokens to claim.
        </Notice>
      )}
      {/* Already claimed: skip the reveal/claim buttons entirely — getClaimAmount
          reverts ("already redeemed") once the signature is consumed. */}
      {result || isClaimed ? null : (
        <ChainGate>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!revealedNum ? (
              <Button variant="outline" onClick={onReveal} disabled={revealing}>
                <Eye />
                {revealing ? "Revealing…" : "Reveal my allocation"}
              </Button>
            ) : (
              revealed != null &&
              revealed > 0n && (
                <Button onClick={onClaim} disabled={confirming || sigInvalid}>
                  {confirming ? (claim.isPending ? "Claiming…" : "Confirming…") : "Claim tokens"}
                </Button>
              )
            )}
          </div>
        </ChainGate>
      )}
      {(isClaimed || result) && <ClaimedNote token={d.token as Address} />}
      {revealedNum && revealed === 0n && !isClaimed && (
        <p className="text-sm text-muted-foreground">Nothing to claim for this wallet.</p>
      )}
      {result && (
        <ClaimSuccessDialog
          open={showResult}
          onOpenChange={setShowResult}
          amount={result.amount}
          hash={result.hash}
          decimals={decimals}
          symbol={symbol}
          token={d.token as Address}
          theme={parseTheme(d.theme)}
        />
      )}
    </div>
  )
}

/** Refined "this wallet isn't on the sealed list" state — shared by the airdrop
 *  and vesting panels. Amber (warning, not error): a no-result that's likely an
 *  actionable wrong-wallet mismatch, so it needs more pull than a neutral gray but
 *  not the false alarm of red. Keeps the looked-up address visible. */
function NotOnList({ title, hint, address }: { title: string; hint: string; address?: Address }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center duration-500 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="grid size-14 place-items-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <SearchX className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-xl leading-tight text-foreground">{title}</p>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {address && (
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
          <i className="size-1.5 rounded-full bg-muted-foreground" aria-hidden />
          {shortAddr(address)}
        </span>
      )}
    </div>
  )
}

/** Calm "temporarily on hold" state — shown when the issuer has paused the
 *  distribution. Mirrors NotOnList; a pulsing gold dot reads it as a live status,
 *  reassuring rather than an error. */
function PausedState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center duration-500 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="grid size-14 place-items-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <Pause className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-xl leading-tight text-foreground">{title}</p>
        <p className="mx-auto max-w-[34ch] text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
        <i className="size-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse" aria-hidden />
        Temporarily paused
      </span>
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
      <PausedState
        title="Claims are paused"
        hint="The issuer has paused this vesting for now. Your allocation is safe — check back later."
      />
    )
  if (ids.length === 0)
    return (
      <NotOnList
        title="No vesting on this schedule"
        hint="This vesting has no grant for the connected wallet. If you were expecting one, switch to the wallet it was granted to."
        address={address}
      />
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
            token={d.token as Address}
            index={ids.length > 1 ? i + 1 : undefined}
            distributionId={d.id}
            self={address}
            theme={theme}
          />
        ))}
      </div>
      {theme?.showAcceptTransfer !== false && <AcceptIncomingTransfer manager={manager} />}
    </div>
  )
}

function VestingClaimItem({
  manager,
  vestingId,
  fee,
  decimals,
  symbol,
  token,
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
  token: Address
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
  const [result, setResult] = useState<{ amount: bigint; hash: Hex } | null>(null)
  const [showResult, setShowResult] = useState(false)
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
    const amount = typeof revealed === "bigint" ? revealed : 0n // the figure they saw, now claimed
    setConfirming(true)
    try {
      const hash = await claim.mutateAsync(
        fee.feeType === FeeType.Gas
          ? { vestingId, feeType: fee.feeType, value: fee.fee }
          : { vestingId, feeType: fee.feeType },
      )
      await confirm(hash)
      setViewHandle(undefined) // the prior reveal is now spent — re-seal so it can be re-read
      setResult({ amount, hash })
      setShowResult(true)
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
      <ChainGate>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {result ? null : !revealedNum ? (
            <Button variant="outline" onClick={onReveal} disabled={revealing}>
              <Eye />
              {revealing ? "Lifting the veil…" : "Decrypt claimable"}
            </Button>
          ) : (
            !revealedZero && (
              <Button onClick={onClaim} disabled={confirming || !fee}>
                {confirming ? (claim.isPending ? "Claiming…" : "Confirming…") : "Claim vested"}
              </Button>
            )
          )}
        </div>
      </ChainGate>
      {theme?.showManage !== false && (
        <VestingActionsDialog
          manager={manager}
          vestingId={vestingId}
          fee={fee}
          decimals={decimals}
          distributionId={distributionId}
          self={self}
          theme={theme}
          index={index}
        />
      )}
      {result ? (
        <ClaimedNote token={token} />
      ) : (
        revealedZero && (
          <p className="text-sm text-muted-foreground">Nothing claimable right now — return as more unlocks.</p>
        )
      )}
      {result && (
        <ClaimSuccessDialog
          open={showResult}
          onOpenChange={setShowResult}
          amount={result.amount}
          hash={result.hash}
          decimals={decimals}
          symbol={symbol}
          token={token}
          theme={theme}
        />
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

/** One-time success modal after a claim — claimed amount + tx hash + explorer link. */
function ClaimSuccessDialog({
  open,
  onOpenChange,
  amount,
  hash,
  decimals,
  symbol,
  token,
  theme,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: bigint
  hash: Hex
  decimals: number
  symbol?: string
  token: Address
  theme?: DistributionTheme
}) {
  // The dialog portals to <body>, outside ClaimFrame's themed subtree — so re-apply
  // the distribution accent + dark mode here, or it falls back to the global gold.
  const accent = theme?.accent
  const style = accent
    ? ({ "--primary": accent, "--primary-foreground": readableInk(accent) } as CSSProperties)
    : undefined
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", theme?.mode === "dark" && "dark")} style={style}>
        <DialogHeader>
          <span className="mx-auto grid size-14 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
          <DialogTitle className="text-center font-display text-2xl">Tokens claimed</DialogTitle>
          <DialogDescription className="text-center">
            Your tokens are now in your confidential balance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-card px-5 py-4 text-center">
            <Kicker className="tracking-[0.14em]">Claimed amount</Kicker>
            <p className="mt-1.5 font-mono text-3xl font-medium tabular-nums text-foreground">
              {formatUnits(amount, decimals)} <span className="text-lg text-muted-foreground">{symbol}</span>
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Kicker className="tracking-[0.12em]">Tx</Kicker>
              <Folio className="truncate">{shortAddr(hash)}</Folio>
              <CopyButton value={hash} title="Copy transaction hash" />
            </span>
            <a
              className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              href={`${EXPLORER}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
            >
              Explorer <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          <Button asChild className="w-full">
            <a href={`/unwrap?token=${token}`}>
              <Unlock />
              Unwrap to ERC-20
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Persistent "this allocation is claimed" confirmation — an accent-tinted banner with
 *  green success markers that pairs with the sealed allocation box above it (airdrop
 *  already-claimed + after any fresh claim). Inherits the distribution accent + light/dark. */
function ClaimedNote({ token }: { token: Address }) {
  return (
    <div className="flex items-start gap-3.5 rounded-lg border border-primary/25 bg-primary/[0.06] px-4 py-3.5 text-left duration-500 animate-in fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none">
      <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-emerald-500/30 bg-card text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 leading-snug">
          <span className="font-medium text-foreground">Claimed to your confidential balance</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.5625rem] font-semibold tracking-[0.14em] text-emerald-600 uppercase dark:text-emerald-400">
            <Check className="size-2.5" strokeWidth={3} aria-hidden />
            Done
          </span>
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your tokens stay encrypted on-chain — unwrap them to a public ERC-20 on the{" "}
          <a
            className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
            href={`/unwrap?token=${token}`}
          >
            token page
          </a>
          .
        </p>
      </div>
    </div>
  )
}

// The public unlock curve at the bottom of the claim page — read from the representative vesting
// on-chain (DB fallback while it loads) so it reflects the real on-chain terms.
function PublicVestingTimeline({ manager, d }: { manager: Address; d: Distribution }) {
  const { address } = useAccount()
  const vestingsQ = useRecipientVestings({ address: manager, recipient: address })
  const { schedule: s } = useRepresentativeSchedule(manager, d)
  // Personal chart ("% of your allocation"): only show when this wallet actually
  // has a vesting here — hide for not-connected or "no vesting found" recipients.
  if (!address || (vestingsQ.data?.length ?? 0) === 0) return null
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
