import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { isAddress, formatUnits, type Address, type Hex } from "viem"
import { useAccount, usePublicClient } from "wagmi"
import { useConfirmTx } from "@/lib/use-confirm-tx"
import { toast } from "sonner"
import { useZamaSDK, useConfidentialApprove } from "@zama-fhe/react-sdk"
import {
  useCreateManagerAndGetAddress,
  useBatchCreateVesting,
  useManagerMaxBatchSize,
  useAllRecipients,
  useRecipientVestings,
  useAdminBatchDiscloseToParty,
  useManagerIsPausable,
  useManagerPaused,
  usePause,
  useUnpause,
  useBatchRevokeVesting,
  useManagerMaxRevokeBatchSize,
} from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { Kicker, Notice } from "@/components/editorial"
import { BalanceLine } from "@/components/balance-line"
import { RecipientPreview } from "@/components/recipient-preview"
import { shortAddr, fmtTime } from "@/lib/format"
import { parseEntries, readRecipientCsv, downloadRecipientTemplate } from "@/lib/recipients"
import { useNowSeconds } from "@/lib/use-now"
import { patchDistribution, recordDisclosure, type Distribution } from "@/lib/api"
import { err, randomSalt, numberConfig } from "./shared"
import { GoLiveDialog } from "./go-live-dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { VestingAdminViewsCard, VestingClaimerCard } from "./vesting-admin"

export function VestingDeployCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const { isConnected } = useAccount()
  const create = useCreateManagerAndGetAddress()
  const [deployed, setDeployed] = useState<{ manager: Address; hash: Hex }>()
  const [phase, setPhase] = useState<string>()
  const [error, setError] = useState<string>()

  const writeBack = async (manager: Address, hash: Hex) => {
    setPhase("Writing back…")
    await patchDistribution(d.id, { contractAddress: manager, deployTxHash: hash, status: "deployed" })
    queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
    setPhase(undefined)
  }

  const onDeploy = async () => {
    setError(undefined)
    try {
      setPhase("Marking deploying…")
      await patchDistribution(d.id, { status: "deploying" })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
      setPhase("Deploying manager…")
      const res = await create.mutateAsync({ token: d.token as Address, userSalt: randomSalt() })
      setDeployed({ manager: res.manager, hash: res.hash })
      await writeBack(res.manager, res.hash)
      toast.success("Vesting manager deployed")
    } catch (e) {
      setError(err(e))
      setPhase(undefined)
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy vesting manager</CardTitle>
        <CardDescription>
          Deploys the per-token vesting manager. Add recipients next — each grant pulls its amount from your
          confidential balance, so there's no upfront pool funding.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onDeploy} disabled={!isConnected || !!phase}>
          {phase ?? "Deploy manager"}
        </Button>
        {deployed && !d.contractAddress && (
          <Notice tone="seal" className="space-y-2">
            <p>Manager deployed ({shortAddr(deployed.manager)}) but the write-back didn't land.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                writeBack(deployed.manager, deployed.hash)
                  .then(() => toast.success("Written back"))
                  .catch((e) => {
                    setError(err(e))
                    toast.error(err(e))
                  })
              }
            >
              Retry write-back
            </Button>
          </Notice>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

export function VestingManageCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const manager = d.contractAddress as Address
  const decimals = numberConfig(d, "decimals", 6)
  const approve = useConfidentialApprove({ tokenAddress: d.token as Address })
  const batchCreate = useBatchCreateVesting({ address: manager, encryptor: () => sdk.relayer })
  const confirm = useConfirmTx()
  const maxBatchQ = useManagerMaxBatchSize({ address: manager })
  const recipientsQ = useAllRecipients({ address: manager })
  const now = useNowSeconds()
  const startTs = numberConfig(d, "startTimestamp", 0)
  const endTs = numberConfig(d, "endTimestamp", 0)
  // Late-added recipients settle on the original schedule, so once the clock has
  // started they may already be (partly) unlocked the moment they're created.
  const vestingStarted = startTs > 0 && now >= startTs

  const [input, setInput] = useState("")
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCsv = (file: File) => {
    void readRecipientCsv(file).then((text) => setInput((v) => (v ? `${v}\n` : "") + text))
  }

  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const existing = new Set((recipientsQ.data ?? []).map((r) => r.toLowerCase()))
  const recipientCount = recipientsQ.data?.length ?? 0
  const fresh = entries.filter((e) => !existing.has(e.recipient.toLowerCase()))
  const batchTotal = fresh.reduce((a, e) => a + e.amount, 0n)
  // Chunk to the manager's max batch size — one tx per chunk (fallback 50 if unknown).
  const maxBatch = maxBatchQ.data && maxBatchQ.data > 0n ? Number(maxBatchQ.data) : 50
  const batchCount = Math.max(1, Math.ceil(fresh.length / maxBatch))

  const vestingParams = (recipient: Address) => ({
    recipient,
    startTimestamp: numberConfig(d, "startTimestamp", 0),
    endTimestamp: numberConfig(d, "endTimestamp", 0),
    cliffSeconds: numberConfig(d, "cliffSeconds", 0),
    releaseIntervalSecs: numberConfig(d, "releaseIntervalSecs", 86_400),
    timelockSeconds: numberConfig(d, "timelockSeconds", 0),
    initialUnlockBps: numberConfig(d, "initialUnlockBps", 0),
    cliffAmountBps: numberConfig(d, "cliffAmountBps", 0),
    isRevocable: d.config.isRevocable === true,
  })

  const goLive = async () => {
    await patchDistribution(d.id, { status: "live" })
    queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
    toast.success("Published — recipients can claim")
  }

  const onAdd = async () => {
    setError(undefined)
    if (fresh.length === 0) return
    try {
      // The manager pulls each grant from your confidential balance — approve it as operator once.
      setProgress("Approving manager (operator)…")
      await approve.mutateAsync({ spender: manager, until: Math.floor(Date.now() / 1000) + 86_400 })
      // One transaction per chunk (batchCreateVesting), respecting the manager's max batch size.
      for (let i = 0; i < batchCount; i++) {
        const chunk = fresh.slice(i * maxBatch, (i + 1) * maxBatch)
        setProgress(batchCount > 1 ? `Creating batch ${i + 1}/${batchCount}…` : "Creating vestings…")
        const hash = await batchCreate.mutateAsync({
          items: chunk.map((e) => ({ params: vestingParams(e.recipient), amount: e.amount })),
        })
        await confirm(hash)
      }
      await recipientsQ.refetch()
      setInput("")
      toast.success(`${fresh.length} vesting${fresh.length === 1 ? "" : "s"} created`)
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Add recipients</CardTitle>
              <CardDescription>
                One <span className="font-mono">address, amount</span> per line, or upload a CSV —{" "}
                <button
                  type="button"
                  onClick={downloadRecipientTemplate}
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  download a template
                </button>
                . Each creates an on-chain vesting funded from your confidential balance.
              </CardDescription>
            </div>
            {d.status !== "live" && (
              <GoLiveDialog
                onConfirm={goLive}
                checks={[
                  { label: "Vesting manager deployed", ok: true },
                  { label: "At least one recipient created", ok: recipientCount > 0, blocking: true, detail: `${recipientCount} created` },
                  { label: "Schedule set", ok: endTs > startTs, detail: `${fmtTime(startTs)} → ${fmtTime(endTs)}` },
                ]}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {vestingStarted && (
            <Notice tone="seal">
              Vesting has already started — recipients you add now settle on the original schedule, so they may be
              immediately part-unlocked (or fully, past the end). Each grant still pulls from your confidential balance.
            </Notice>
          )}
          <textarea
            className="min-h-28 w-full rounded-sm border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={"0xRecipient…, 100\n0xAnother…, 250"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!address}
              onClick={() => address && setInput((v) => `${v}${v && !v.endsWith("\n") ? "\n" : ""}${address}, `)}
            >
              Add my address
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadCsv(f)
                e.target.value = ""
              }}
            />
            <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()}>
              Upload CSV
            </Button>
            <span className="text-muted-foreground">
              {fresh.length} to add
              {entries.length - fresh.length > 0 && ` · ${entries.length - fresh.length} already vesting`}
              {errors.length > 0 && ` · ${errors.length} error${errors.length > 1 ? "s" : ""}`}
            </span>
          </div>
          {errors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-destructive">
              {errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <BalanceLine token={d.token as Address} decimals={decimals} compareTo={batchTotal} />
          {batchTotal > 0n && (
            <p className="text-xs text-muted-foreground">
              This batch · <span className="font-mono text-foreground">{formatUnits(batchTotal, decimals)}</span> across {fresh.length}
              {batchCount > 1 && ` · ${batchCount} transactions (≤ ${maxBatch}/tx)`}
            </p>
          )}
          <RecipientPreview entries={entries} issued={existing} decimals={decimals} issuedLabel="Vesting" />
          <Button onClick={onAdd} disabled={fresh.length === 0 || !!progress}>
            {progress ?? (fresh.length ? `Create ${fresh.length} vesting${fresh.length === 1 ? "" : "s"}` : "Create vestings")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipients ({recipientsQ.data?.length ?? 0})</CardTitle>
          <CardDescription>On-chain vesting recipients. Amounts are encrypted — not shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recipientsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No recipients yet.</p>}
          {recipientsQ.data?.map((r) => (
            <div key={r} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="font-mono">{shortAddr(r)}</span>
              <RecipientManageSheet d={d} recipient={r as Address} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// Inline pause/resume row — rendered inside the Overview card (no wrapper card of its own).
export function VestingPauseRow({ d }: { d: Distribution }) {
  const manager = d.contractAddress as Address
  const pausableQ = useManagerIsPausable({ address: manager })
  const pausedQ = useManagerPaused({ address: manager })
  const pause = usePause({ address: manager })
  const unpause = useUnpause({ address: manager })
  const publicClient = usePublicClient()
  const [confirming, setConfirming] = useState(false)
  const isPaused = pausedQ.data === true
  const pausable = pausableQ.data === true
  const pausing = pause.isPending || unpause.isPending || confirming

  const onTogglePause = async () => {
    try {
      // mutateAsync resolves on submission (returns the tx hash), so wait for the
      // receipt to be mined before re-reading status — otherwise we'd toast and
      // refetch the pause state before the change is on-chain.
      const hash = isPaused ? await unpause.mutateAsync(undefined) : await pause.mutateAsync(undefined)
      setConfirming(true)
      await publicClient?.waitForTransactionReceipt({ hash })
      await pausedQ.refetch()
      toast.success(isPaused ? "Claims resumed" : "Claims & grants paused")
    } catch (e) {
      toast.error(err(e))
    } finally {
      setConfirming(false)
    }
  }

  if (!pausable) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
      <div>
        <Kicker className="tracking-[0.12em]">Claims &amp; grants</Kicker>
        <p className="mt-1 text-sm text-foreground">{pausedQ.isLoading ? "…" : isPaused ? "Paused" : "Open"}</p>
      </div>
      <Button
        variant={isPaused ? "default" : "destructive"}
        size="sm"
        onClick={onTogglePause}
        disabled={pausing || pausedQ.isLoading}
      >
        {pausing ? "…" : isPaused ? "Resume" : "Pause"}
      </Button>
    </div>
  )
}

function VestingRevokeCard({ d, recipient }: { d: Distribution; recipient: Address }) {
  const manager = d.contractAddress as Address
  const isRevocable = d.config.isRevocable === true
  const revokeVestingsQ = useRecipientVestings({ address: manager, recipient })
  const revokeVestingIds = revokeVestingsQ.data ?? []
  const maxRevokeQ = useManagerMaxRevokeBatchSize({ address: manager })
  const batchRevoke = useBatchRevokeVesting({ address: manager })
  const confirm = useConfirmTx()

  const onRevoke = async () => {
    if (revokeVestingIds.length === 0) return
    try {
      // Revoke all of this recipient's vestings, chunked to the manager's cap.
      const max = maxRevokeQ.data && maxRevokeQ.data > 0n ? Number(maxRevokeQ.data) : 50
      for (let i = 0; i < revokeVestingIds.length; i += max) {
        const hash = await batchRevoke.mutateAsync({ vestingIds: revokeVestingIds.slice(i, i + max) })
        await confirm(hash)
      }
      await revokeVestingsQ.refetch()
      toast.success(`Revoked ${revokeVestingIds.length} vesting${revokeVestingIds.length === 1 ? "" : "s"}`)
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revoke vesting</CardTitle>
        <CardDescription>
          Ends this recipient's vesting on-chain. Requires the manager's revoker role. Irreversible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isRevocable ? (
          <p className="text-xs text-muted-foreground">
            Grants in this distribution were created non-revocable — they can't be revoked.
          </p>
        ) : (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={revokeVestingIds.length === 0 || batchRevoke.isPending}>
                  {batchRevoke.isPending
                    ? "Revoking…"
                    : revokeVestingIds.length > 1
                      ? `Revoke ${revokeVestingIds.length} vestings…`
                      : "Revoke vesting…"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Revoke {revokeVestingIds.length === 1 ? "this vesting" : `${revokeVestingIds.length} vestings`}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Ends <span className="font-mono text-foreground">{shortAddr(recipient)}</span>'s{" "}
                    {revokeVestingIds.length === 1 ? "vesting" : `${revokeVestingIds.length} vestings`} on-chain. This is an
                    admin action and can't be undone from here.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {!revokeVestingsQ.isLoading && revokeVestingIds.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">No vesting found for this recipient.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

const DISCLOSURE_TYPES = [
  { value: DisclosureType.TotalAllocation, label: "Total allocation" },
  { value: DisclosureType.VestedAmount, label: "Vested amount" },
  { value: DisclosureType.ClaimableAmount, label: "Claimable amount" },
  { value: DisclosureType.SettledAmount, label: "Settled (claimed) amount" },
]

// Sentinel for the recipient selector: disclose the chosen figure to one auditor
// across every recipient's vestings in a single transaction.
const ALL_RECIPIENTS = "__all__"

export function VestingDisclosureCard({ d, recipient: lockedRecipient }: { d: Distribution; recipient?: Address }) {
  const manager = d.contractAddress as Address
  const recipientsQ = useAllRecipients({ address: manager })
  const [recipientState, setRecipient] = useState("")
  const recipient = lockedRecipient ?? recipientState
  const [party, setParty] = useState("")
  const [dtype, setDtype] = useState<DisclosureType>(DisclosureType.TotalAllocation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [shared, setShared] = useState<string>()

  // "All recipients" is only selectable in the standalone (non-locked) admin card.
  const isAll = !lockedRecipient && recipientState === ALL_RECIPIENTS
  const allRecipients = useMemo(() => recipientsQ.data ?? [], [recipientsQ.data])

  // Single-recipient path: read just the selected recipient's vestings.
  const vestingsQ = useRecipientVestings({
    address: manager,
    recipient: isAddress(recipient) ? (recipient as Address) : undefined,
  })

  // All-recipients path: fan out one read per recipient (collectors rendered below)
  // and aggregate their vesting ids so we can disclose across everyone in one tx.
  const [idsByRecipient, setIdsByRecipient] = useState<Record<string, readonly Hex[]>>({})
  const onCollected = useCallback(
    (r: Address, ids: readonly Hex[]) => setIdsByRecipient((prev) => (prev[r] === ids ? prev : { ...prev, [r]: ids })),
    [],
  )
  const allLoaded = isAll && allRecipients.length > 0 && allRecipients.every((r) => idsByRecipient[r] !== undefined)
  const allIds = useMemo(
    () => (isAll ? allRecipients.flatMap((r) => idsByRecipient[r] ?? []) : []),
    [isAll, allRecipients, idsByRecipient],
  )

  const vestingIds = isAll ? allIds : vestingsQ.data ?? []
  const disclose = useAdminBatchDiscloseToParty({ address: manager })
  const typeLabel = DISCLOSURE_TYPES.find((t) => t.value === dtype)?.label ?? "figure"

  const onDisclose = async () => {
    setError(undefined)
    if (vestingIds.length === 0 || !isAddress(party)) return
    setBusy(true)
    try {
      // Disclose the chosen figure across every selected vesting in one tx.
      await disclose.mutateAsync({
        vestingIds,
        disclosureTypes: vestingIds.map(() => dtype),
        party: party as Address,
      })
      toast.success("Disclosed to auditor — read-only & irreversible")
      // Record each so the auditor can reverse-look-up what was disclosed. Non-blocking.
      // Attribute each vesting to its owning recipient (matters in all-recipients mode).
      const records = isAll
        ? allRecipients.flatMap((r) => (idsByRecipient[r] ?? []).map((vid) => ({ vid, owner: r })))
        : vestingIds.map((vid) => ({ vid, owner: recipient as Address }))
      records.forEach(({ vid, owner }) =>
        void recordDisclosure({
          distributionId: d.id,
          manager,
          vestingId: vid,
          party: party as Address,
          disclosureType: dtype,
          recipient: owner,
        }).catch(() => {}),
      )
      // The audit deep-link is per-vesting; only meaningful for a single recipient.
      setShared(isAll ? undefined : `/audit?manager=${manager}&vesting=${vestingIds[0]}&type=${dtype}`)
      setParty("")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selective disclosure</CardTitle>
        <CardDescription>
          Grant an auditor read-only access to a recipient's encrypted vesting figure. Irreversible — ACL grants are
          append-only and can't be revoked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`grid gap-3 ${lockedRecipient ? "" : "sm:grid-cols-2"}`}>
          {!lockedRecipient && (
            <div className="space-y-2">
              <Label htmlFor="disc-recipient">Recipient</Label>
              <Select value={recipientState || undefined} onValueChange={setRecipient}>
                <SelectTrigger id="disc-recipient" className="w-full">
                  <SelectValue placeholder="Select recipient…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RECIPIENTS}>All recipients</SelectItem>
                  {recipientsQ.data?.map((r) => (
                    <SelectItem key={r} value={r}>
                      {shortAddr(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="disc-type">Disclose</Label>
            <Select value={String(dtype)} onValueChange={(v) => setDtype(Number(v) as DisclosureType)}>
              <SelectTrigger id="disc-type" className="w-full">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-party">Auditor address</Label>
          <Input id="disc-party" placeholder="0x…" value={party} onChange={(e) => setParty(e.target.value.trim())} />
        </div>
        {/* All-recipients mode: fan out one read per recipient to collect their vesting ids. */}
        {isAll && allRecipients.map((r) => <VestingIdsCollector key={r} manager={manager} recipient={r} onCollected={onCollected} />)}
        {isAll && (
          <p className="text-xs text-muted-foreground">
            {allLoaded
              ? `Discloses ${typeLabel.toLowerCase()} for all ${allRecipients.length} recipient${allRecipients.length === 1 ? "" : "s"} · ${vestingIds.length} vesting${vestingIds.length === 1 ? "" : "s"} in one transaction.`
              : "Loading recipients…"}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={vestingIds.length === 0 || !isAddress(party) || busy || (isAll && !allLoaded)}>
              {busy ? "Disclosing…" : isAll && !allLoaded ? "Loading recipients…" : "Disclose to auditor"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disclose to auditor?</AlertDialogTitle>
              <AlertDialogDescription>
                You're granting <span className="font-mono text-foreground">{shortAddr(party)}</span> read-only access to{" "}
                {isAll ? (
                  <span className="text-foreground">
                    all {allRecipients.length} recipients' {typeLabel.toLowerCase()} across {vestingIds.length} vesting
                    {vestingIds.length === 1 ? "" : "s"}
                  </span>
                ) : (
                  <>
                    <span className="font-mono text-foreground">{shortAddr(recipient)}</span>'s{" "}
                    <span className="text-foreground">{typeLabel.toLowerCase()}</span>
                  </>
                )}
                . This is <span className="text-foreground">irreversible</span> — ACL grants are append-only and cannot be
                revoked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDisclose}>Grant access</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {isAddress(recipient) && !vestingsQ.isLoading && vestingIds.length === 0 && (
          <p className="text-xs text-muted-foreground">No vesting found for that recipient.</p>
        )}
        {shared && (
          <p className="break-all text-xs text-muted-foreground">
            Share with the auditor:{" "}
            <a className="font-mono underline" href={shared}>
              {shared}
            </a>
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

/** Invisible helper: reads one recipient's vesting ids and reports them up, so the
 *  disclosure card can aggregate across all recipients without calling a hook in a loop. */
function VestingIdsCollector({
  manager,
  recipient,
  onCollected,
}: {
  manager: Address
  recipient: Address
  onCollected: (recipient: Address, ids: readonly Hex[]) => void
}) {
  const q = useRecipientVestings({ address: manager, recipient })
  useEffect(() => {
    if (q.data) onCollected(recipient, q.data)
  }, [q.data, recipient, onCollected])
  return null
}

// Per-recipient admin actions, opened from a Recipients row — the address is locked so
// there's no selector to repeat. Figures / Claim on behalf / Disclose for this recipient.
function RecipientManageSheet({ d, recipient }: { d: Distribution; recipient: Address }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          Manage →
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="font-mono text-base">{shortAddr(recipient)}</SheetTitle>
        </SheetHeader>
        <div className="px-6 pb-6">
          <Tabs defaultValue="figures" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="figures">Figures</TabsTrigger>
              <TabsTrigger value="claim">Claim</TabsTrigger>
              <TabsTrigger value="disclose">Disclose</TabsTrigger>
              <TabsTrigger value="revoke">Revoke</TabsTrigger>
            </TabsList>
            <TabsContent value="figures">
              <VestingAdminViewsCard d={d} recipient={recipient} />
            </TabsContent>
            <TabsContent value="claim">
              <VestingClaimerCard d={d} recipient={recipient} />
            </TabsContent>
            <TabsContent value="disclose">
              <VestingDisclosureCard d={d} recipient={recipient} />
            </TabsContent>
            <TabsContent value="revoke">
              <VestingRevokeCard d={d} recipient={recipient} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
