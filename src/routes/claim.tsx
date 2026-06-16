import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Lock } from "lucide-react"
import { useUserDecrypt } from "@zama-fhe/react-sdk"
import {
  useGetClaimAmount,
  useClaim,
  useAirdropIsSignatureClaimed,
  useAirdropIsSignatureValid,
  useAirdropIsPaused,
} from "@tokenops/sdk/fhe-airdrop/react"
import {
  useRecipientVestings,
  useManagerFeeInfo,
  useManagerPaused,
  useGetClaimableAmount,
  useClaim as useVestingClaim,
} from "@tokenops/sdk/fhe-vesting/react"
import { FeeType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Redaction } from "@/components/ui/redaction"
import { StatusBadge } from "@/components/status-badge"
import { VestingActionsDialog, AcceptIncomingTransfer } from "@/components/vesting-actions"
import { Kicker, Folio, Notice } from "@/components/editorial"
import { getDistributionBySlug, listRecipients, type Distribution } from "@/lib/api"
import { useTokenMeta } from "@/lib/tokens"
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

  if (distQ.isLoading)
    return (
      <ClaimFrame>
        <Kicker>Loading the statement…</Kicker>
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
  const end = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const notStarted = start != null && now < start
  const ended = end != null && now > end
  const supported = d.type === "airdrop" || d.type === "vesting"
  // Airdrop's window closes claiming; vesting stays claimable after the end (fully vested).
  const airdropBlocked = d.type === "airdrop" && (notStarted || ended)

  return (
    <ClaimFrame theme={theme} brandName={d.name}>
      <div className="space-y-10">
        <header className="claim-reveal space-y-4 text-center">
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-seal" aria-hidden />
            <Kicker>Confidential claim · {d.type}</Kicker>
          </span>
          <h1 className="font-display text-[clamp(2.2rem,5vw,3.25rem)] leading-[1.04] text-foreground">
            {theme.title ?? d.name}
          </h1>
          <p className="mx-auto max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted-foreground">
            {theme.description ?? "Only you can read your own figure. It stays sealed until you decrypt it with your wallet."}
          </p>
        </header>

        <div
          className="claim-card claim-reveal mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-card"
          style={{ animationDelay: "0.12s" }}
        >
          {/* Claim action */}
          <div className="px-6 py-8 text-center sm:px-8 sm:py-10">
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
            ) : airdropBlocked ? (
              notStarted ? (
                <div className="space-y-2">
                  <Kicker>Claim opens in</Kicker>
                  <div className="font-mono text-[clamp(1.75rem,6vw,2.5rem)] leading-none tabular-nums text-foreground">
                    {fmtCountdown(start! - now)}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Kicker>Claim window closed</Kicker>
                  <p className="text-sm text-muted-foreground">{fmtTime(end)}</p>
                </div>
              )
            ) : d.type === "airdrop" ? (
              <AirdropClaimGate
                d={d}
                decimals={decimals}
                symbol={meta.symbol}
                closesIn={end != null ? end - now : null}
                isConnected={isConnected}
              />
            ) : !isConnected ? (
              <ConnectPrompt />
            ) : (
              <VestingClaimPanel d={d} decimals={decimals} symbol={meta.symbol} startsIn={notStarted ? start! - now : null} />
            )}
          </div>

          {/* Distribution details */}
          <div className="border-t border-border px-6 py-6 sm:px-8">
            <Kicker>Distribution details</Kicker>
            <dl className="mt-4 space-y-2.5 text-sm">
              <DetailRow label="Token" value={meta.symbol ?? shortAddr(d.token)} />
              <DetailRow label="Type" value={<span className="capitalize">{d.type}</span>} />
              {(start || end) && (
                <DetailRow label={d.type === "vesting" ? "Vesting" : "Window"} value={fmtRange(start, end)} />
              )}
              {d.contractAddress && (
                <DetailRow
                  label={d.type === "vesting" ? "Manager" : "Pool"}
                  value={<span className="font-mono text-xs">{shortAddr(d.contractAddress)}</span>}
                />
              )}
              <DetailRow label="Status" value={<StatusBadge status={d.status} />} />
            </dl>
          </div>

          {/* Sealed assurance */}
          <div className="border-t border-border px-6 py-6 sm:px-8">
            <span className="inline-flex items-center gap-2">
              <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              <Kicker>Sealed end-to-end</Kicker>
            </span>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your amount is encrypted on-chain and never broadcast in plaintext. Only your wallet can decrypt it.
            </p>
          </div>
        </div>
      </div>
    </ClaimFrame>
  )
}

/** Standalone, branded shell for the customer-facing claim page (no app chrome). */
function ClaimFrame({ theme, brandName, children }: { theme?: DistributionTheme; brandName?: string; children: ReactNode }) {
  const accent = theme?.accent
  // Map the distribution's accent onto both our seal token and RainbowKit's accent
  // vars, so the Connect Wallet button matches the configured theme color.
  const style = accent
    ? ({
        "--seal": accent,
        "--seal-foreground": readableInk(accent),
        "--rk-colors-accentColor": accent,
        "--rk-colors-accentColorForeground": readableInk(accent),
      } as CSSProperties)
    : undefined
  return (
    <div className={cn("claim-page geist-type flex min-h-svh flex-col bg-background text-foreground", theme?.mode === "dark" && "dark")} style={style}>
      <div className="h-[2px] w-full bg-seal" />
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
    try {
      await claim.mutateAsync({ encryptedInput, signature: artifact.signature as Hex })
      claimedQ.refetch() // re-read on-chain claimed state
      toast.success("Claimed into your confidential balance")
    } catch (e) {
      toast.error(err(e))
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
            {revealing ? "Lifting the veil…" : "Decrypt my amount"}
          </Button>
        )}
        <Button onClick={onClaim} disabled={claim.isPending || isClaimed || sigInvalid}>
          {isClaimed ? "Claimed ✓" : claim.isPending ? "Claiming…" : "Claim tokens"}
        </Button>
      </div>
      {isClaimed && <ClaimedNote />}
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
}: {
  manager: Address
  vestingId: Hex
  fee?: { feeType: FeeType; fee: bigint }
  decimals: number
  symbol?: string
  index?: number
  distributionId?: string
  self?: Address
}) {
  const getClaimable = useGetClaimableAmount({ address: manager })
  const claim = useVestingClaim({ address: manager })
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
    try {
      await claim.mutateAsync(
        fee.feeType === FeeType.Gas
          ? { vestingId, feeType: fee.feeType, value: fee.fee }
          : { vestingId, feeType: fee.feeType },
      )
      setViewHandle(undefined) // the prior reveal is now spent — re-seal so it can be re-read
      toast.success("Claimed your vested tokens")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <div className={cn("space-y-4", index && "rounded-md border border-border p-4")}>
      {index && (
        <div className="flex items-center justify-between gap-3">
          <Kicker>Vesting № {index}</Kicker>
          <Folio>{shortAddr(vestingId)}</Folio>
        </div>
      )}
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
            {revealing ? "Lifting the veil…" : "Decrypt claimable"}
          </Button>
        )}
        <Button onClick={onClaim} disabled={claim.isPending || !fee || claim.isSuccess || revealedZero}>
          {claim.isSuccess ? "Claimed ✓" : claim.isPending ? "Claiming…" : "Claim vested"}
        </Button>
        <VestingActionsDialog
          manager={manager}
          vestingId={vestingId}
          fee={fee}
          decimals={decimals}
          distributionId={distributionId}
          self={self}
        />
      </div>
      {claim.isSuccess ? (
        <ClaimedNote />
      ) : (
        revealedZero && (
          <p className="text-sm text-muted-foreground">Nothing claimable right now — return as more unlocks.</p>
        )
      )}
    </div>
  )
}

/** A labeled confidential figure — censor bar until the holder decrypts it. */
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
  const text =
    revealed && typeof value === "bigint" ? `${formatUnits(value, decimals)}${symbol ? ` ${symbol}` : ""}` : undefined
  return (
    <div className="claim-figure flex flex-col items-center gap-3 text-center">
      <Kicker className="tracking-[0.14em]">{label}</Kicker>
      <Redaction
        revealed={revealed}
        loading={loading}
        chars={11}
        className="font-mono text-[clamp(2.25rem,9vw,3.25rem)] leading-none font-medium text-foreground"
      >
        {text}
      </Redaction>
      {revealed && (
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] tracking-[0.06em] text-muted-foreground uppercase">
          <Lock className="size-3" aria-hidden />
          Visible to you only
        </span>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="claim-detail">
      <dt className="text-muted-foreground">{label}</dt>
      <span className="leader" aria-hidden />
      <dd className="text-right font-medium text-foreground">{value}</dd>
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
