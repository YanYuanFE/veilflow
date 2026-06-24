import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Rocket, RefreshCw, UserPlus, Upload, Plus, Pause, Play, Ban, Eye, Settings2, CalendarRange } from "lucide-react"
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
  useVestingInfo,
} from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { CopyButton } from "@/components/copy-button"
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef, type RowSelectionState } from "@tanstack/react-table"
import { VestingAdminViewsCard, VestingClaimerCard } from "./vesting-admin"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { VestingTimeline } from "@/components/vesting-timeline"
import {
  type VestingSchedule,
  scheduleFromConfig,
  describeSchedule,
  useRepresentativeSchedule,
} from "@/lib/vesting-schedule"

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
      const res = await create.mutateAsync({ token: d.token as Address, userSalt: randomSalt(), splitEnabled: d.config.splitEnabled === true })
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
          <Rocket />
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
              <RefreshCw />
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
            className="min-h-28 w-full rounded-[4px] border border-input bg-transparent p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
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
              <UserPlus />
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
              <Upload />
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
            <Plus />
            {progress ?? (fresh.length ? `Create ${fresh.length} vesting${fresh.length === 1 ? "" : "s"}` : "Create vestings")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <RecipientsTable d={d} />
    </div>
  )
}

// Recipients as a selectable data table — pick rows, then batch-disclose or batch-revoke
// across the selection from the toolbar (top-right). Per-row Manage handles one recipient.
function RecipientsTable({ d }: { d: Distribution }) {
  const manager = d.contractAddress as Address
  const queryClient = useQueryClient()
  const recipientsQ = useAllRecipients({ address: manager })
  const data = useMemo(() => (recipientsQ.data ?? []) as Address[], [recipientsQ.data])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns = useMemo<ColumnDef<Address>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />
        ),
        enableSorting: false,
      },
      {
        id: "recipient",
        header: "Recipient",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-foreground">{shortAddr(row.original)}</span>
            <CopyButton value={row.original} title="Copy address" />
            <RecipientRevokeBadge manager={manager} recipient={row.original} />
          </span>
        ),
      },
      {
        id: "actions",
        header: () => "Action",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <RecipientManageSheet d={d} recipient={row.original} />
          </div>
        ),
      },
    ],
    [d, manager],
  )

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => r,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  })

  const selected = table.getSelectedRowModel().rows.map((r) => r.original)
  const afterBatch = () => {
    setRowSelection({})
    void queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
    void recipientsQ.refetch()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Recipients ({data.length})</CardTitle>
            <CardDescription>On-chain vesting recipients. Amounts are encrypted — not shown.</CardDescription>
          </div>
          {selected.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              <Sheet onOpenChange={(o) => !o && setRowSelection({})}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye />
                    Disclose
                  </Button>
                </SheetTrigger>
                <SheetContent aria-describedby={undefined}>
                  <SheetTitle className="sr-only">Disclose to auditor</SheetTitle>
                  <div className="p-6 pt-12">
                    <VestingDisclosureCard d={d} recipients={selected} />
                  </div>
                </SheetContent>
              </Sheet>
              <VestingRevokeCard d={d} recipients={selected} onDone={afterBatch} bare />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipients yet.</p>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id} className={h.id === "actions" ? "text-right" : undefined}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
        {isPaused ? <Play /> : <Pause />}
        {pausing ? "…" : isPaused ? "Resume" : "Pause"}
      </Button>
    </div>
  )
}

function VestingRevokeCard({
  d,
  recipient,
  recipients,
  onDone,
  bare,
}: {
  d: Distribution
  recipient?: Address
  recipients?: readonly Address[]
  onDone?: () => void
  // bare = no Card wrapper, just the confirm button (for the recipients-table toolbar).
  bare?: boolean
}) {
  const manager = d.contractAddress as Address
  const isRevocable = d.config.isRevocable === true
  const maxRevokeQ = useManagerMaxRevokeBatchSize({ address: manager })
  const batchRevoke = useBatchRevokeVesting({ address: manager })
  const confirm = useConfirmTx()

  // Revoke every vesting of one recipient (Manage sheet) or a selected subset (recipients table).
  const targets = useMemo<readonly Address[]>(() => recipients ?? (recipient ? [recipient] : []), [recipients, recipient])
  const single = targets.length === 1
  const [idsByRecipient, setIdsByRecipient] = useState<Record<string, readonly Hex[]>>({})
  const onCollected = useCallback(
    (r: Address, ids: readonly Hex[]) => setIdsByRecipient((prev) => (prev[r] === ids ? prev : { ...prev, [r]: ids })),
    [],
  )
  const loaded = targets.length > 0 && targets.every((r) => idsByRecipient[r] !== undefined)
  const revokeVestingIds = useMemo(() => targets.flatMap((r) => idsByRecipient[r] ?? []), [targets, idsByRecipient])

  const onRevoke = async () => {
    if (revokeVestingIds.length === 0) return
    try {
      // Revoke every selected vesting, chunked to the manager's cap.
      const max = maxRevokeQ.data && maxRevokeQ.data > 0n ? Number(maxRevokeQ.data) : 50
      for (let i = 0; i < revokeVestingIds.length; i += max) {
        const hash = await batchRevoke.mutateAsync({ vestingIds: revokeVestingIds.slice(i, i + max) })
        await confirm(hash)
      }
      toast.success(`Revoked ${revokeVestingIds.length} vesting${revokeVestingIds.length === 1 ? "" : "s"}`)
      onDone?.()
    } catch (e) {
      toast.error(err(e))
    }
  }

  const whose = single
    ? `${shortAddr(targets[0])}'s ${revokeVestingIds.length === 1 ? "vesting" : `${revokeVestingIds.length} vestings`}`
    : `${targets.length} recipients' ${revokeVestingIds.length} vesting${revokeVestingIds.length === 1 ? "" : "s"}`

  // Invisible id collectors + the confirm-to-revoke control (an AlertDialog). Bare in the
  // table toolbar; Card-wrapped in the per-recipient Manage sheet.
  const control = (
    <>
      {targets.map((r) => (
        <VestingIdsCollector key={r} manager={manager} recipient={r} onCollected={onCollected} />
      ))}
      {!isRevocable ? (
        bare ? null : (
          <p className="text-xs text-muted-foreground">
            Grants in this distribution were created non-revocable — they can't be revoked.
          </p>
        )
      ) : (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size={bare ? "sm" : undefined}
              disabled={revokeVestingIds.length === 0 || !loaded || batchRevoke.isPending}
            >
              <Ban />
              {batchRevoke.isPending
                ? "Revoking…"
                : !loaded
                  ? "Loading…"
                  : bare
                    ? "Revoke"
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
                Ends <span className="text-foreground">{whose}</span> on-chain. This is an admin action and can't be undone
                from here.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )

  if (bare) return control

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revoke vesting</CardTitle>
        <CardDescription>
          Ends {single ? "this recipient's" : "the selected recipients'"} vesting on-chain. Requires the manager's revoker
          role. Irreversible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {control}
        {loaded && revokeVestingIds.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            No vesting found for {single ? "this recipient" : "the selected recipients"}.
          </p>
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

export function VestingDisclosureCard({
  d,
  recipient,
  recipients,
}: {
  d: Distribution
  recipient?: Address
  recipients?: readonly Address[]
}) {
  const manager = d.contractAddress as Address
  const [party, setParty] = useState("")
  const [dtype, setDtype] = useState<DisclosureType>(DisclosureType.TotalAllocation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [shared, setShared] = useState<string>()

  // The recipients to disclose across — an explicit subset (from the recipients table) or a
  // single recipient (from their Manage sheet). Fan out one vesting-id read per target.
  const targets = useMemo<readonly Address[]>(() => recipients ?? (recipient ? [recipient] : []), [recipients, recipient])
  const single = targets.length === 1
  const [idsByRecipient, setIdsByRecipient] = useState<Record<string, readonly Hex[]>>({})
  const onCollected = useCallback(
    (r: Address, ids: readonly Hex[]) => setIdsByRecipient((prev) => (prev[r] === ids ? prev : { ...prev, [r]: ids })),
    [],
  )
  const loaded = targets.length > 0 && targets.every((r) => idsByRecipient[r] !== undefined)
  const vestingIds = useMemo(() => targets.flatMap((r) => idsByRecipient[r] ?? []), [targets, idsByRecipient])

  const disclose = useAdminBatchDiscloseToParty({ address: manager })
  const typeLabel = DISCLOSURE_TYPES.find((t) => t.value === dtype)?.label ?? "figure"

  const onDisclose = async () => {
    setError(undefined)
    if (vestingIds.length === 0 || !isAddress(party)) return
    setBusy(true)
    try {
      // Disclose the chosen figure across every selected vesting in one tx.
      const { handles } = await disclose.mutateAsync({
        vestingIds,
        disclosureTypes: vestingIds.map(() => dtype),
        party: party as Address,
      })
      toast.success("Disclosed to auditor — read-only & irreversible")
      // handles[i] ↔ vestingIds[i]; attribute each to its owning recipient.
      const owners = targets.flatMap((r) => (idsByRecipient[r] ?? []).map(() => r))
      vestingIds.forEach((vid, i) =>
        void recordDisclosure({
          distributionId: d.id,
          manager,
          vestingId: vid,
          handle: handles[i],
          party: party as Address,
          disclosureType: dtype,
          recipient: owners[i],
        }).catch(() => {}),
      )
      // A single recipient gets a per-vesting deep-link; a batch spans many vestings, so we
      // link to the manager and let the auditor connect their wallet — the audit page lists
      // every figure disclosed to them by party.
      const path = single ? `/audit?manager=${manager}&vesting=${vestingIds[0]}&type=${dtype}` : `/audit?manager=${manager}`
      setShared(`${window.location.origin}${path}`)
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
          Grant an auditor read-only access to {single ? "this recipient's" : `${targets.length} recipients'`} encrypted
          vesting figure in one transaction. Irreversible — ACL grants are append-only and can't be revoked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <div className="space-y-2">
          <Label htmlFor="disc-party">Auditor address</Label>
          <Input id="disc-party" placeholder="0x…" value={party} onChange={(e) => setParty(e.target.value.trim())} />
        </div>
        {/* Collect each target recipient's vesting ids (one read per recipient). */}
        {targets.map((r) => (
          <VestingIdsCollector key={r} manager={manager} recipient={r} onCollected={onCollected} />
        ))}
        {!single && (
          <p className="text-xs text-muted-foreground">
            {loaded
              ? `Discloses ${typeLabel.toLowerCase()} for ${targets.length} recipients · ${vestingIds.length} vesting${vestingIds.length === 1 ? "" : "s"} in one transaction.`
              : "Loading recipients…"}
          </p>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={vestingIds.length === 0 || !isAddress(party) || busy || !loaded}>
              <Eye />
              {busy ? "Disclosing…" : !loaded ? "Loading…" : "Disclose to auditor"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disclose to auditor?</AlertDialogTitle>
              <AlertDialogDescription>
                You're granting <span className="font-mono text-foreground">{shortAddr(party)}</span> read-only access to{" "}
                <span className="text-foreground">
                  {single ? `${shortAddr(targets[0])}'s ` : `${targets.length} recipients' `}
                  {typeLabel.toLowerCase()}
                  {!single && ` across ${vestingIds.length} vesting${vestingIds.length === 1 ? "" : "s"}`}
                </span>
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
        {loaded && vestingIds.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No vesting found for {single ? "that recipient" : "the selected recipients"}.
          </p>
        )}
        {shared && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <Kicker className="tracking-[0.12em]">Share with the auditor</Kicker>
            {!single && (
              <p className="text-xs text-muted-foreground">
                Disclosed across {vestingIds.length} vesting{vestingIds.length === 1 ? "" : "s"}. The auditor connects this
                wallet to read every figure disclosed to them.
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <a className="min-w-0 flex-1 truncate font-mono text-xs underline" href={shared} target="_blank" rel="noreferrer">
                {shared}
              </a>
              <CopyButton value={shared} title="Copy audit link" />
            </div>
          </div>
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
          <Settings2 />
          Manage
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

// Decide the schedule source: read the representative vesting on-chain once deployed, else fall
// back to the create-time config — the chain is the source of truth, the DB snapshot can drift.
export function VestingScheduleSummary({ d }: { d: Distribution }) {
  return d.contractAddress ? (
    <OnchainScheduleSummary manager={d.contractAddress as Address} d={d} />
  ) : (
    <ScheduleView schedule={scheduleFromConfig(d)} />
  )
}

function OnchainScheduleSummary({ manager, d }: { manager: Address; d: Distribution }) {
  const { schedule } = useRepresentativeSchedule(manager, d)
  return <ScheduleView schedule={schedule} />
}

// Unlock rules as a sentence on the Overview; "View chart" opens the public unlock curve.
function ScheduleView({ schedule: s }: { schedule: VestingSchedule }) {
  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Kicker className="tracking-[0.12em]">Unlock schedule</Kicker>
          <Badge variant="secondary">{s.isRevocable ? "Revocable" : "Non-revocable"}</Badge>
        </div>
        {s.end > s.start && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarRange />
                View chart
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Unlock curve</DialogTitle>
                <DialogDescription>The unlock shape is public; recipient amounts stay encrypted.</DialogDescription>
              </DialogHeader>
              <VestingTimeline
                start={s.start}
                end={s.end}
                cliffSeconds={s.cliffSeconds}
                releaseIntervalSecs={s.releaseIntervalSecs}
                initialUnlockBps={s.initialUnlockBps}
                cliffAmountBps={s.cliffAmountBps}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{describeSchedule(s)}</p>
    </div>
  )
}

// Per-row revoke indicator for the recipients table: probes each of this recipient's vestings
// on-chain and badges any that are revoked (revokeTimestamp > 0) — state the DB doesn't track.
function RecipientRevokeBadge({ manager, recipient }: { manager: Address; recipient: Address }) {
  const vestingsQ = useRecipientVestings({ address: manager, recipient })
  const ids = vestingsQ.data ?? []
  const [revoked, setRevoked] = useState<Record<string, boolean>>({})
  const onResult = useCallback(
    (id: Hex, r: boolean) => setRevoked((prev) => (prev[id] === r ? prev : { ...prev, [id]: r })),
    [],
  )
  const count = ids.filter((id) => revoked[id]).length
  return (
    <>
      {ids.map((id) => (
        <RevokeProbe key={id} manager={manager} vestingId={id} onResult={onResult} />
      ))}
      {count > 0 && <Badge variant="destructive">{count === ids.length ? "Revoked" : `${count} revoked`}</Badge>}
    </>
  )
}

function RevokeProbe({
  manager,
  vestingId,
  onResult,
}: {
  manager: Address
  vestingId: Hex
  onResult: (id: Hex, revoked: boolean) => void
}) {
  const infoQ = useVestingInfo({ address: manager, vestingId })
  const revoked = (infoQ.data?.revokeTimestamp ?? 0) > 0
  useEffect(() => {
    if (infoQ.data) onResult(vestingId, revoked)
  }, [infoQ.data, vestingId, revoked, onResult])
  return null
}
