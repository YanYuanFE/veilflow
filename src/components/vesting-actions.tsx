import { useState, type CSSProperties } from "react"
import { isAddress, parseUnits, zeroAddress, type Address, type Hex } from "viem"
import { toast } from "sonner"
import { SquareCheck, Split as SplitIcon, ArrowRightLeft, Eye } from "lucide-react"
import { useZamaSDK } from "@zama-fhe/react-sdk"
import {
  usePartialClaim,
  useSplitVesting,
  useManagerIsSplitEnabled,
  useInitiateVestingTransfer,
  useDirectVestingTransfer,
  useCancelVestingTransfer,
  useAcceptVestingTransfer,
  usePendingVestingTransfer,
  useDiscloseToParty,
} from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType, FeeType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Kicker, SectionHead } from "@/components/editorial"
import { CopyButton } from "@/components/copy-button"
import { shortAddr, fmtTime } from "@/lib/format"
import { recordDisclosure } from "@/lib/api"
import { useConfirmTx } from "@/lib/use-confirm-tx"
import { readableInk, type DistributionTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const DISCLOSURE_TYPES = [
  { value: DisclosureType.TotalAllocation, label: "Total allocation" },
  { value: DisclosureType.VestedAmount, label: "Vested amount" },
  { value: DisclosureType.ClaimableAmount, label: "Claimable amount" },
  { value: DisclosureType.SettledAmount, label: "Settled (claimed) amount" },
]

/** Recipient-side power actions for one of their own vestings: partial claim,
 *  split, transfer (2-step / direct / cancel), and self-service disclosure. */
export function VestingActionsDialog({
  manager,
  vestingId,
  fee,
  decimals,
  distributionId,
  self,
  theme,
}: {
  manager: Address
  vestingId: Hex
  fee?: { feeType: FeeType; fee: bigint }
  decimals: number
  distributionId?: string
  self?: Address
  theme?: DistributionTheme
}) {
  const sdk = useZamaSDK()
  const partial = usePartialClaim({ address: manager, encryptor: () => sdk.relayer })
  const splitEnabledQ = useManagerIsSplitEnabled({ address: manager })
  const split = useSplitVesting({ address: manager, encryptor: () => sdk.relayer })
  const initiate = useInitiateVestingTransfer({ address: manager })
  const direct = useDirectVestingTransfer({ address: manager })
  const cancel = useCancelVestingTransfer({ address: manager })
  const pendingQ = usePendingVestingTransfer({ address: manager, vestingId })
  const confirm = useConfirmTx()

  const [pcAmount, setPcAmount] = useState("")
  const [splitNum, setSplitNum] = useState("1")
  const [splitDen, setSplitDen] = useState("2")
  const [splitTo, setSplitTo] = useState("")
  const [xferTo, setXferTo] = useState("")
  const [xferDays, setXferDays] = useState("7")

  const splitEnabled = splitEnabledQ.data === true
  const pending = pendingQ.data
  const hasPending = !!pending && pending.newRecipient !== zeroAddress && pending.expiresAt > 0

  const pcAmountWei = (() => {
    try {
      return pcAmount ? parseUnits(pcAmount, decimals) : undefined
    } catch {
      return undefined
    }
  })()

  // Live share readout for the split form — numerator/denominator as a percentage.
  const splitPct = (() => {
    const n = Number(splitNum)
    const d = Number(splitDen)
    if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0 || n < 0) return null
    return (n / d) * 100
  })()

  const onPartial = async () => {
    if (!pcAmountWei || !fee) return
    try {
      const hash = await partial.mutateAsync(
        fee?.feeType === FeeType.Gas
          ? { vestingId, amount: pcAmountWei, value: fee.fee }
          : { vestingId, amount: pcAmountWei },
      )
      await confirm(hash)
      setPcAmount("")
      toast.success("Partial amount claimed")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onSplit = async () => {
    const num = Number(splitNum)
    const den = Number(splitDen)
    // Whole-number share that's at most the full vesting (numerator ≤ denominator).
    if (!isAddress(splitTo) || !Number.isInteger(num) || !Number.isInteger(den) || num < 1 || den < 1 || num > den) return
    try {
      await split.mutateAsync({
        vestingId,
        numerator: BigInt(num),
        denominator: BigInt(den),
        newRecipient: splitTo as Address,
      })
      setSplitTo("")
      toast.success("Vesting split — a new vesting was created for the recipient")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onInitiate = async () => {
    // Require a positive accept window — a 0-second window can never be accepted.
    if (!isAddress(xferTo) || !(Number(xferDays) > 0)) return
    try {
      const hash = await initiate.mutateAsync({ vestingId, newRecipient: xferTo as Address, transferDurationSeconds: Math.round(Number(xferDays) * 86_400) })
      await confirm(hash)
      await pendingQ.refetch()
      setXferTo("")
      toast.success("Transfer initiated — the new recipient must accept")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onDirect = async () => {
    if (!isAddress(xferTo)) return
    try {
      const hash = await direct.mutateAsync({ vestingId, newOwner: xferTo as Address })
      await confirm(hash)
      setXferTo("")
      toast.success("Vesting transferred")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onCancel = async () => {
    try {
      const hash = await cancel.mutateAsync({ vestingId })
      await confirm(hash)
      await pendingQ.refetch()
      toast.success("Pending transfer cancelled")
    } catch (e) {
      toast.error(err(e))
    }
  }

  // This dialog renders in a portal outside the claim page's themed wrapper, so
  // re-apply the distribution's configured accent (and mode) here — otherwise it
  // falls back to the default --primary instead of the brand color.
  const brandStyle = theme?.accent
    ? ({ "--primary": theme.accent, "--primary-foreground": readableInk(theme.accent) } as CSSProperties)
    : undefined

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className={cn("max-h-[85svh] overflow-y-auto", theme?.mode === "dark" && "dark")} style={brandStyle}>
        <DialogHeader>
          <DialogTitle>Manage this vesting</DialogTitle>
          <DialogDescription>
            Advanced actions for{" "}
            <span className="inline-flex items-center gap-0.5 align-middle">
              <span title={vestingId} className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground">
                {shortAddr(vestingId)}
              </span>
              <CopyButton value={vestingId} title="Copy vesting id" />
            </span>
            . Amounts stay encrypted.
          </DialogDescription>
        </DialogHeader>

        {/* Partial claim */}
        <section className="space-y-2 border-t border-border pt-4">
          <SectionHead icon={SquareCheck}>Partial claim</SectionHead>
          <p className="text-xs text-muted-foreground">Claim a specific amount of what's currently vested, rather than all of it.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="pc-amount">Amount</Label>
              <Input id="pc-amount" inputMode="decimal" placeholder="0.0" value={pcAmount} onChange={(e) => setPcAmount(e.target.value)} />
            </div>
            <Button size="sm" onClick={onPartial} disabled={!pcAmountWei || !fee || partial.isPending}>
              {partial.isPending ? "Claiming…" : "Claim amount"}
            </Button>
          </div>
        </section>

        {/* Split */}
        <section className="space-y-2 border-t border-border pt-4">
          <SectionHead icon={SplitIcon}>Split off a portion</SectionHead>
          {!splitEnabled ? (
            <p className="text-xs text-muted-foreground">Splitting isn't enabled on this manager.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Move a fraction of this vesting to another recipient as a new vesting.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-16 space-y-2">
                  <Label htmlFor="split-num">Share</Label>
                  <Input id="split-num" inputMode="numeric" value={splitNum} onChange={(e) => setSplitNum(e.target.value)} />
                </div>
                <span className="pb-2 text-muted-foreground">/</span>
                <div className="w-16 space-y-2">
                  <Label htmlFor="split-den">of</Label>
                  <Input id="split-den" inputMode="numeric" value={splitDen} onChange={(e) => setSplitDen(e.target.value)} />
                </div>
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Label htmlFor="split-to">New recipient</Label>
                  <Input id="split-to" placeholder="0x…" value={splitTo} onChange={(e) => setSplitTo(e.target.value.trim())} />
                </div>
              </div>
              {splitPct != null && (
                <p className="font-mono text-xs text-muted-foreground">
                  Fraction: <span className="text-foreground">{splitPct.toFixed(1)}%</span> of total
                </p>
              )}
              <Button size="sm" onClick={onSplit} disabled={!isAddress(splitTo) || split.isPending}>
                {split.isPending ? "Splitting…" : "Split vesting"}
              </Button>
            </>
          )}
        </section>

        {/* Transfer */}
        <section className="space-y-2 border-t border-border pt-4">
          <SectionHead icon={ArrowRightLeft}>Transfer ownership</SectionHead>
          {hasPending ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Pending transfer to <span className="font-mono text-foreground">{shortAddr(pending!.newRecipient)}</span> · expires{" "}
                {fmtTime(pending!.expiresAt)}. The new recipient must accept it.
              </p>
              <Button size="sm" variant="outline" onClick={onCancel} disabled={cancel.isPending}>
                {cancel.isPending ? "Cancelling…" : "Cancel transfer"}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Two-step: initiate, then the new recipient accepts within the window. Or transfer directly (immediate).
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1 space-y-2">
                  <Label htmlFor="xfer-to">New recipient</Label>
                  <Input id="xfer-to" placeholder="0x…" value={xferTo} onChange={(e) => setXferTo(e.target.value.trim())} />
                </div>
                <div className="w-24 space-y-2">
                  <Label htmlFor="xfer-days">Accept by (days)</Label>
                  <Input id="xfer-days" inputMode="numeric" value={xferDays} onChange={(e) => setXferDays(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm" onClick={onInitiate} disabled={!isAddress(xferTo) || initiate.isPending}>
                  {initiate.isPending ? "Initiating…" : "Initiate transfer"}
                </Button>
                <Button size="sm" variant="outline" onClick={onDirect} disabled={!isAddress(xferTo) || direct.isPending}>
                  {direct.isPending ? "Transferring…" : "Transfer directly"}
                </Button>
              </div>
            </>
          )}
        </section>

        {/* Self-service disclosure */}
        <DiscloseSection manager={manager} vestingId={vestingId} distributionId={distributionId} self={self} />
      </DialogContent>
    </Dialog>
  )
}

function DiscloseSection({
  manager,
  vestingId,
  distributionId,
  self,
}: {
  manager: Address
  vestingId: Hex
  distributionId?: string
  self?: Address
}) {
  const disclose = useDiscloseToParty({ address: manager })
  const [party, setParty] = useState("")
  const [dtype, setDtype] = useState<DisclosureType>(DisclosureType.TotalAllocation)

  const onDisclose = async () => {
    if (!isAddress(party)) return
    try {
      const { handle } = await disclose.mutateAsync({ vestingId, party: party as Address, disclosureType: dtype })
      // Best-effort: record so the auditor can reverse-look-up + decrypt the disclosed handle.
      void recordDisclosure({
        distributionId,
        manager,
        vestingId,
        handle,
        party: party as Address,
        disclosureType: dtype,
        recipient: self,
      }).catch(() => {})
      setParty("")
      toast.success("Disclosed to party — read-only & irreversible")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <SectionHead icon={Eye}>Disclose to a party</SectionHead>
      <p className="text-xs text-muted-foreground">
        Grant someone read-only access to one of your figures (e.g. a lender or accountant). Irreversible.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="disc-figure">Figure</Label>
          <Select value={String(dtype)} onValueChange={(v) => setDtype(Number(v) as DisclosureType)}>
            <SelectTrigger id="disc-figure" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DISCLOSURE_TYPES.map((t) => (
                <SelectItem key={t.value} value={String(t.value)}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-to">Party address</Label>
          <Input id="disc-to" placeholder="0x…" value={party} onChange={(e) => setParty(e.target.value.trim())} />
        </div>
      </div>
      <Button size="sm" onClick={onDisclose} disabled={!isAddress(party) || disclose.isPending}>
        {disclose.isPending ? "Disclosing…" : "Disclose"}
      </Button>
    </section>
  )
}

/** Wallet-level: accept a vesting being transferred TO you (you won't see it in
 *  your list until accepted, so it's keyed by the vestingId the sender shares). */
export function AcceptIncomingTransfer({ manager }: { manager: Address }) {
  const accept = useAcceptVestingTransfer({ address: manager })
  const confirm = useConfirmTx()
  const [vid, setVid] = useState("")
  const valid = /^0x[0-9a-fA-F]{64}$/.test(vid)

  const onAccept = async () => {
    if (!valid) return
    try {
      const hash = await accept.mutateAsync({ vestingId: vid as Hex })
      await confirm(hash)
      setVid("")
      toast.success("Transfer accepted — the vesting is now yours")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-3">
      <Kicker className="tracking-[0.12em]">Accept an incoming transfer</Kicker>
      <p className="text-xs text-muted-foreground">
        Someone transferring a vesting to you? Paste the vesting id they shared to accept it.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-2">
          <Label htmlFor="accept-vid">Vesting id</Label>
          <Input id="accept-vid" placeholder="0x… (32-byte id)" value={vid} onChange={(e) => setVid(e.target.value.trim())} />
        </div>
        <Button size="sm" onClick={onAccept} disabled={!valid || accept.isPending}>
          {accept.isPending ? "Accepting…" : "Accept transfer"}
        </Button>
      </div>
      {vid && !valid && <p className="text-xs text-destructive">Must be a 32-byte hex id.</p>}
    </div>
  )
}
