import { useState, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { isAddress, parseUnits, parseEther, formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useZamaSDK, useConfidentialApprove, useConfidentialTransfer } from "@zama-fhe/react-sdk"
import { encryptUint64 } from "@tokenops/sdk/fhe-airdrop"
import {
  useCreateAndFundConfidentialAirdropAndGetAddress,
  useSignClaimAuthorization,
  useSetPaused,
  useExtendClaimWindow,
  useWithdraw,
  useAirdropWithdrawGasFee,
  useWithdrawOtherToken,
  useWithdrawOtherConfidentialToken,
  useAirdropGrantRole,
  useAirdropRevokeRole,
  useAirdropHasRole,
  useAirdropIsPaused,
  useAirdropEndTime,
  useAirdropHasClaimEnded,
  useAirdropIsSignatureClaimed,
  useAirdropIsSignatureValid,
  useAirdropCanExtendClaimWindow,
} from "@tokenops/sdk/fhe-airdrop/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateTimePicker } from "@/components/ui/datetime-picker"
import { Kicker, Notice } from "@/components/editorial"
import { BalanceLine } from "@/components/balance-line"
import { RecipientPreview } from "@/components/recipient-preview"
import { shortAddr, fmtTime } from "@/lib/format"
import { parseEntries, readRecipientCsv, downloadRecipientTemplate } from "@/lib/recipients"
import { useNowSeconds } from "@/lib/use-now"
import { patchDistribution, listRecipients, addRecipient, type Distribution, type RecipientArtifact } from "@/lib/api"
import { FACTORY_SEPOLIA, err, randomSalt } from "./shared"

// AccessControl's DEFAULT_ADMIN_ROLE is the zero bytes32 — the airdrop's only role.
const ADMIN_ROLE = ("0x" + "0".repeat(64)) as Hex
import { GoLiveDialog } from "./go-live-dialog"

export function DeployCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { isConnected } = useAccount()
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const startTs = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const canExtend = d.config.canExtendClaimWindow === true
  const admin = (typeof d.config.admin === "string" ? d.config.admin : d.creator) as Address
  const now = useNowSeconds()
  const scheduleError =
    endTs === null ? "This draft has no claim-close time." : endTs <= now ? "Claim window already closed." : undefined

  const [fund, setFund] = useState("")
  const approve = useConfidentialApprove({ tokenAddress: d.token as Address })
  const create = useCreateAndFundConfidentialAirdropAndGetAddress({ encryptor: () => sdk.relayer })

  // Reconciliation: hold the deploy result so a failed write-back can be retried
  // without redeploying the (already on-chain) contract.
  const [deployed, setDeployed] = useState<{ airdrop: Address; hash: Hex }>()
  const [phase, setPhase] = useState<string>()
  const [error, setError] = useState<string>()
  const fundWei = (() => {
    try {
      return fund ? parseUnits(fund, decimals) : undefined
    } catch {
      return undefined
    }
  })()

  const writeBack = async (airdrop: Address, hash: Hex) => {
    setPhase("Writing back…")
    // Privacy red line: the funding total is a plaintext amount — never persist it to the CMS.
    await patchDistribution(d.id, { contractAddress: airdrop, deployTxHash: hash, status: "funded" })
    queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
    setPhase(undefined)
  }

  const onDeploy = async () => {
    setError(undefined)
    if (!fund || scheduleError) return
    try {
      // Step 1: approve the factory as operator. mutateAsync resolves only after
      // the receipt is mined (SDK returns it), so step 2 is safe to run next.
      setPhase("Approving operator (1/2)…")
      await approve.mutateAsync({ spender: FACTORY_SEPOLIA, until: Math.floor(Date.now() / 1000) + 86_400 })

      setPhase("Marking deploying…")
      await patchDistribution(d.id, { status: "deploying" })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })

      setPhase("Deploying & funding (2/2)…")
      const nowAtDeploy = Math.floor(Date.now() / 1000)
      const res = await create.mutateAsync({
        params: {
          token: d.token as Address,
          startTimestamp: startTs ?? nowAtDeploy, // null = open at deploy
          endTimestamp: endTs!, // guarded by scheduleError
          canExtendClaimWindow: canExtend,
          admin,
        },
        userSalt: randomSalt(),
        amount: parseUnits(fund, decimals),
      })
      setDeployed({ airdrop: res.airdrop, hash: res.hash })
      await writeBack(res.airdrop, res.hash)
      toast.success("Airdrop deployed & funded")
    } catch (e) {
      setError(err(e))
      setPhase(undefined)
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy &amp; fund</CardTitle>
        <CardDescription>
          One click runs two wallet transactions: approve the factory as operator, then deploy &amp; fund the pool.
          Opens {startTs ? fmtTime(startTs) : "at deploy"} → closes {fmtTime(endTs)}
          {canExtend ? " (extendable)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fund">Funding amount</Label>
          <Input id="fund" inputMode="decimal" placeholder="0.0" value={fund} onChange={(e) => setFund(e.target.value)} />
        </div>
        <BalanceLine token={d.token as Address} decimals={decimals} compareTo={fundWei} />
        <Button onClick={onDeploy} disabled={!isConnected || !fund || !!phase || !!scheduleError}>
          {phase ?? "Approve & deploy"}
        </Button>
        {scheduleError && <p className="text-sm text-destructive">{scheduleError}</p>}

        {deployed && !d.contractAddress && (
          <Notice tone="seal" className="space-y-2">
            <p>Contract deployed on-chain ({shortAddr(deployed.airdrop)}) but the write-back didn't land.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                writeBack(deployed.airdrop, deployed.hash)
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

export function IssueCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const airdrop = d.contractAddress as Address | null
  const sign = useSignClaimAuthorization()

  const [input, setInput] = useState("")
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCsv = (file: File) => {
    void readRecipientCsv(file).then((text) => setInput((v) => (v ? `${v}\n` : "") + text))
  }

  const recipientsQ = useQuery({ queryKey: ["recipients", d.id], queryFn: () => listRecipients(d.id) })
  const now = useNowSeconds()
  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const issued = new Set((recipientsQ.data ?? []).map((r) => r.recipient.toLowerCase()))
  const issuedCount = recipientsQ.data?.length ?? 0
  const fresh = entries.filter((e) => !issued.has(e.recipient.toLowerCase()))
  const batchTotal = fresh.reduce((a, e) => a + e.amount, 0n)
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  // Prefer the on-chain end state (reflects extensions); while that read loads,
  // fall back to the config end time so an already-closed window still blocks
  // issuing authorizations recipients could never claim.
  const ended = useAirdropHasClaimEnded({ address: airdrop as Address }).data
  const windowClosed = ended ?? (endTs != null && now > endTs)

  const goLive = async () => {
    await patchDistribution(d.id, { status: "live" })
    queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
    toast.success("Published — recipients can claim")
  }

  const onIssue = async () => {
    setError(undefined)
    if (!airdrop || fresh.length === 0) return
    try {
      for (let i = 0; i < fresh.length; i++) {
        const e = fresh[i]
        setProgress(`Encrypting & signing ${i + 1}/${fresh.length}…`)
        // Encryption happens here, in the issuer's browser — the plaintext amount never leaves it.
        const enc = await encryptUint64({
          encryptor: sdk.relayer,
          contractAddress: airdrop,
          userAddress: e.recipient,
          value: e.amount,
        })
        const signature = await sign.mutateAsync({
          airdropAddress: airdrop,
          recipient: e.recipient,
          encryptedAmountHandle: enc.handle,
        })
        // Persist only the ciphertext artifact + address + signature. No plaintext amount.
        await addRecipient(d.id, { recipient: e.recipient, handle: enc.handle, inputProof: enc.inputProof, signature })
        queryClient.invalidateQueries({ queryKey: ["recipients", d.id] })
      }
      setInput("")
      toast.success(`${fresh.length} claim${fresh.length === 1 ? "" : "s"} issued`)
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
                . Encrypted &amp; signed per recipient, in your browser.
              </CardDescription>
            </div>
            {d.status === "funded" && (
              <GoLiveDialog
                onConfirm={goLive}
                checks={[
                  { label: "Pool deployed & funded", ok: true },
                  { label: "At least one recipient issued", ok: issuedCount > 0, blocking: true, detail: `${issuedCount} issued` },
                  { label: "Claim window still open", ok: !windowClosed, blocking: true, detail: endTs ? `closes ${fmtTime(endTs)}` : undefined },
                ]}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
              {entries.length - fresh.length > 0 && ` · ${entries.length - fresh.length} already issued`}
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
          {batchTotal > 0n && (
            <p className="text-xs text-muted-foreground">
              This batch · <span className="font-mono text-foreground">{formatUnits(batchTotal, decimals)}</span> across {fresh.length}
            </p>
          )}
          <RecipientPreview entries={entries} issued={issued} decimals={decimals} issuedLabel="Issued" />
          {windowClosed && (
            <Notice tone="void">
              The claim window closed {fmtTime(endTs)} — anything issued now can't be claimed. Extend the window from
              Admin controls first.
            </Notice>
          )}
          <Button onClick={onIssue} disabled={!airdrop || fresh.length === 0 || !!progress || windowClosed}>
            {progress ?? (fresh.length ? `Issue ${fresh.length} claim${fresh.length === 1 ? "" : "s"}` : "Issue claims")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issued ({recipientsQ.data?.length ?? 0})</CardTitle>
          <CardDescription>Ciphertext artifacts stored for delivery. Amounts are encrypted — not shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {recipientsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No claims issued yet.</p>}
          {recipientsQ.data?.map((r) => (
            <IssuedRow key={r.id} airdrop={airdrop as Address} r={r} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// One issued artifact, with its live on-chain audit status: has this recipient
// claimed yet, and is the authorization still valid (signature recognised by the clone).
function IssuedRow({ airdrop, r }: { airdrop: Address; r: RecipientArtifact }) {
  const claimed =
    useAirdropIsSignatureClaimed({ address: airdrop, user: r.recipient as Address, encryptedAmountHandle: r.handle as Hex }).data === true
  const valid = useAirdropIsSignatureValid({
    address: airdrop,
    encryptedAmountHandle: r.handle as Hex,
    signature: (r.signature ?? undefined) as Hex | undefined,
    caller: r.recipient as Address,
  }).data
  const status = claimed
    ? { label: "Claimed", cls: "text-seal" }
    : valid === false
      ? { label: "Invalid", cls: "text-destructive" }
      : { label: "Pending", cls: "text-muted-foreground" }
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
      <span className="font-mono">{shortAddr(r.recipient)}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">🔒 {shortAddr(r.handle)}</span>
        <span className={`text-[0.6875rem] font-semibold tracking-[0.06em] uppercase ${status.cls}`}>{status.label}</span>
      </span>
    </div>
  )
}

// Top up an already-deployed airdrop. The clone's pool is just its own ERC-7984
// confidential balance, so a direct confidentialTransfer to the contract funds
// it (per the SDK: fund "via createAndFund… or a follow-up confidentialTransfer").
// No factory / userSalt / gasFee needed — works for any airdrop.
export function TopUpPoolCard({ token, pool, decimals }: { token: Address; pool: Address; decimals: number }) {
  const { isConnected } = useAccount()
  const transfer = useConfidentialTransfer({ tokenAddress: token })
  const [amount, setAmount] = useState("")
  const amountWei = (() => {
    try {
      return amount ? parseUnits(amount, decimals) : undefined
    } catch {
      return undefined
    }
  })()

  const onTopUp = async () => {
    if (!amountWei) return
    try {
      await transfer.mutateAsync({ to: pool, amount: amountWei })
      setAmount("")
      toast.success("Pool topped up")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top up pool</CardTitle>
        <CardDescription>
          Send more confidential tokens straight to the airdrop so newly added recipients stay covered — a direct
          transfer to the pool, no redeploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BalanceLine token={token} decimals={decimals} compareTo={amountWei} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="topup">Amount</Label>
            <Input id="topup" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button onClick={onTopUp} disabled={!isConnected || !amountWei || transfer.isPending}>
            {transfer.isPending ? "Sending…" : "Top up pool"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const { address } = useAccount()
  const airdrop = d.contractAddress as Address

  const pausedQ = useAirdropIsPaused({ address: airdrop })
  const endQ = useAirdropEndTime({ address: airdrop })
  const canExtendQ = useAirdropCanExtendClaimWindow({ address: airdrop })
  const setPaused = useSetPaused({ address: airdrop })
  const extend = useExtendClaimWindow({ address: airdrop })
  const withdraw = useWithdraw({ address: airdrop })
  const withdrawGas = useAirdropWithdrawGasFee({ address: airdrop })
  const grantRole = useAirdropGrantRole({ address: airdrop })
  const revokeRole = useAirdropRevokeRole({ address: airdrop })
  const wOther = useWithdrawOtherToken({ address: airdrop })
  const wOtherConf = useWithdrawOtherConfidentialToken({ address: airdrop })

  const [newEnd, setNewEnd] = useState("")
  const [to, setTo] = useState("")
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [feeTo, setFeeTo] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [roleTarget, setRoleTarget] = useState("")
  const [rescueToken, setRescueToken] = useState("")
  const [rescueTo, setRescueTo] = useState("")
  const [rescueKind, setRescueKind] = useState<"confidential" | "erc20">("confidential")

  const hasRoleQ = useAirdropHasRole({
    address: airdrop,
    role: ADMIN_ROLE,
    account: isAddress(roleTarget) ? (roleTarget as Address) : undefined,
  })

  const isPaused = pausedQ.data === true
  const newEndTs = newEnd ? Math.floor(new Date(newEnd).getTime() / 1000) : null
  // Require the current on-chain end time to be loaded before allowing extend —
  // a stale/undefined read must not let an earlier close time through.
  const extendValid = newEndTs != null && typeof endQ.data === "number" && newEndTs > endQ.data

  const onPause = async () => {
    try {
      await setPaused.mutateAsync({ paused: !isPaused })
      await pausedQ.refetch()
      toast.success(isPaused ? "Claims resumed" : "Claims paused")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onExtend = async () => {
    if (!extendValid || newEndTs == null) return
    try {
      await extend.mutateAsync({ newEndTime: newEndTs })
      await endQ.refetch()
      setNewEnd("")
      toast.success("Claim window extended")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onWithdraw = async () => {
    const recipient = (isAddress(to) ? to : address) as Address | undefined
    if (!recipient) return
    try {
      await withdraw.mutateAsync({ recipient })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
      setConfirmWithdraw(false)
      toast.success("Withdrew remaining balance")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onWithdrawGasFee = async () => {
    const recipient = (isAddress(feeTo) ? feeTo : address) as Address | undefined
    if (!recipient) return
    try {
      // Blank amount → 0n, which the contract treats as "withdraw the entire gas-fee balance".
      await withdrawGas.mutateAsync({ recipient, amount: feeAmount.trim() ? parseEther(feeAmount.trim()) : 0n })
      setFeeAmount("")
      toast.success("Withdrew collected gas fees")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onGrantRole = async () => {
    if (!isAddress(roleTarget)) return
    try {
      await grantRole.mutateAsync({ role: ADMIN_ROLE, accountTarget: roleTarget as Address })
      await hasRoleQ.refetch()
      toast.success("Admin role granted")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onRevokeRole = async () => {
    if (!isAddress(roleTarget)) return
    try {
      await revokeRole.mutateAsync({ role: ADMIN_ROLE, accountTarget: roleTarget as Address })
      await hasRoleQ.refetch()
      toast.success("Admin role revoked")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onRescue = async () => {
    const recipient = (isAddress(rescueTo) ? rescueTo : address) as Address | undefined
    if (!isAddress(rescueToken) || !recipient) return
    try {
      if (rescueKind === "confidential") await wOtherConf.mutateAsync({ tokenAddress: rescueToken as Address, recipient })
      else await wOther.mutateAsync({ tokenAddress: rescueToken as Address, recipient })
      setRescueToken("")
      toast.success("Tokens rescued")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin controls</CardTitle>
        <CardDescription>Operate the live airdrop — only the admin can run these.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Pause / resume */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <Kicker className="tracking-[0.12em]">Claims</Kicker>
            <p className="mt-1 text-sm text-foreground">{pausedQ.isLoading ? "…" : isPaused ? "Paused" : "Open"}</p>
          </div>
          <Button
            variant={isPaused ? "default" : "destructive"}
            size="sm"
            onClick={onPause}
            disabled={setPaused.isPending || pausedQ.isLoading}
          >
            {setPaused.isPending ? "…" : isPaused ? "Resume claims" : "Pause claims"}
          </Button>
        </div>

        {/* Extend window */}
        <div className="space-y-2 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-3">
            <Kicker className="tracking-[0.12em]">Claim window</Kicker>
            {typeof endQ.data === "number" && <span className="text-xs text-muted-foreground">Closes {fmtTime(endQ.data)}</span>}
          </div>
          {canExtendQ.data === false ? (
            <p className="text-xs text-muted-foreground">Fixed at creation — not extendable.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[14rem] flex-1">
                  <DateTimePicker value={newEnd} onChange={setNewEnd} placeholder="New close time" />
                </div>
                <Button size="sm" variant="outline" onClick={onExtend} disabled={!extendValid || extend.isPending}>
                  {extend.isPending ? "Extending…" : "Extend"}
                </Button>
              </div>
              {newEnd && !extendValid && <p className="text-sm text-destructive">Must be later than the current close time.</p>}
            </>
          )}
        </div>

        {/* Withdraw remaining */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Withdraw remaining</Kicker>
          <p className="text-xs text-muted-foreground">Pulls all unclaimed confidential tokens out of the pool to an address.</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[14rem] flex-1">
              <Input
                placeholder={address ? `${shortAddr(address)} (default: you)` : "0x… recipient"}
                value={to}
                onChange={(e) => setTo(e.target.value.trim())}
              />
            </div>
            {confirmWithdraw ? (
              <div className="flex items-center gap-2">
                <Button variant="destructive" size="sm" onClick={onWithdraw} disabled={withdraw.isPending}>
                  {withdraw.isPending ? "Withdrawing…" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmWithdraw(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setConfirmWithdraw(true)} disabled={!!to && !isAddress(to)}>
                Withdraw…
              </Button>
            )}
          </div>
          {to && !isAddress(to) && <p className="text-sm text-destructive">Invalid address.</p>}
        </div>

        {/* Withdraw gas fees */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Withdraw gas fees</Kicker>
          <p className="text-xs text-muted-foreground">
            Reclaim the ETH gas fees recipients paid on claim. Needs the fee-collector role. Leave the amount blank to
            withdraw everything.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-2">
              <Label htmlFor="gasfee-to">To</Label>
              <Input
                id="gasfee-to"
                placeholder={address ? `${shortAddr(address)} (you)` : "0x… recipient"}
                value={feeTo}
                onChange={(e) => setFeeTo(e.target.value.trim())}
              />
            </div>
            <div className="w-32 space-y-2">
              <Label htmlFor="gasfee-amount">Amount (ETH)</Label>
              <Input
                id="gasfee-amount"
                inputMode="decimal"
                placeholder="All"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onWithdrawGasFee}
              disabled={withdrawGas.isPending || (!!feeTo && !isAddress(feeTo))}
            >
              {withdrawGas.isPending ? "Withdrawing…" : "Withdraw fees"}
            </Button>
          </div>
          {feeTo && !isAddress(feeTo) && <p className="text-sm text-destructive">Invalid address.</p>}
        </div>

        {/* Delegate admin */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Delegate admin</Kicker>
          <p className="text-xs text-muted-foreground">
            Grant another wallet the admin role — it can then sign claims, pause, extend and withdraw.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[14rem] flex-1">
              <Input placeholder="0x… wallet" value={roleTarget} onChange={(e) => setRoleTarget(e.target.value.trim())} />
            </div>
            <Button size="sm" onClick={onGrantRole} disabled={!isAddress(roleTarget) || grantRole.isPending}>
              {grantRole.isPending ? "Granting…" : "Grant"}
            </Button>
            <Button size="sm" variant="outline" onClick={onRevokeRole} disabled={!isAddress(roleTarget) || revokeRole.isPending}>
              {revokeRole.isPending ? "Revoking…" : "Revoke"}
            </Button>
          </div>
          {isAddress(roleTarget) && (
            <p className="text-xs text-muted-foreground">
              {shortAddr(roleTarget)} {hasRoleQ.data === true ? "holds" : hasRoleQ.data === false ? "does not hold" : "…"} the admin role.
            </p>
          )}
        </div>

        {/* Rescue stray tokens */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Rescue stray tokens</Kicker>
          <p className="text-xs text-muted-foreground">Withdraw a non-pool token accidentally sent to the airdrop.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Token 0x…" value={rescueToken} onChange={(e) => setRescueToken(e.target.value.trim())} />
            <Select value={rescueKind} onValueChange={(v) => setRescueKind(v as "confidential" | "erc20")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidential">Confidential (ERC-7984)</SelectItem>
                <SelectItem value="erc20">Public ERC-20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[14rem] flex-1">
              <Input
                placeholder={address ? `${shortAddr(address)} (you)` : "0x… recipient"}
                value={rescueTo}
                onChange={(e) => setRescueTo(e.target.value.trim())}
              />
            </div>
            <Button size="sm" variant="outline" onClick={onRescue} disabled={!isAddress(rescueToken) || wOther.isPending || wOtherConf.isPending}>
              {wOther.isPending || wOtherConf.isPending ? "Rescuing…" : "Rescue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
