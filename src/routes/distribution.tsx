import { useState, useMemo, useRef, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { isAddress, parseUnits, getAddress, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useZamaSDK, useConfidentialApprove } from "@zama-fhe/react-sdk"
import { encryptUint64 } from "@tokenops/sdk/fhe-airdrop"
import {
  useCreateAndFundConfidentialAirdropAndGetAddress,
  useSignClaimAuthorization,
} from "@tokenops/sdk/fhe-airdrop/react"
import {
  useCreateManagerAndGetAddress,
  useCreateVesting,
  useAllRecipients,
  useRecipientVestings,
  useAdminDiscloseToParty,
} from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType } from "@tokenops/sdk/fhe-vesting"
import { useDisperse } from "@tokenops/sdk/fhe-disperse/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { shortAddr, fmtTime } from "@/lib/format"
import {
  getDistribution,
  patchDistribution,
  listRecipients,
  addRecipient,
  type Distribution,
} from "@/lib/api"

const FACTORY_SEPOLIA = "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" as Address
const DISPERSE_SINGLETON = "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4" as Address
const EXPLORER = "https://sepolia.etherscan.io"

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function randomSalt(): Hex {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return ("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")) as Hex
}

export function DistributionDetail() {
  const { id } = useParams<{ id: string }>()
  const { address } = useAccount()

  const q = useQuery({
    queryKey: ["distribution", id],
    queryFn: () => getDistribution(id!),
    enabled: !!id,
  })

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error) return <p className="text-sm text-destructive">{q.error.message}</p>
  if (!q.data) return null

  const d = q.data
  const isOwner = !!address && address.toLowerCase() === d.creator

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-muted-foreground capitalize">
            {d.type} · /{d.slug}
          </p>
        </div>
      </div>

      <Overview d={d} />

      {!isOwner ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Connect as the creator ({shortAddr(d.creator)}) to manage this distribution.
          </CardContent>
        </Card>
      ) : d.type === "airdrop" ? (
        // Stay on deploy until the address is written back — i.e. the tx is confirmed.
        !d.contractAddress ? <DeployCard d={d} /> : <IssueCard d={d} />
      ) : d.type === "vesting" ? (
        !d.contractAddress ? <VestingDeployCard d={d} /> : <VestingManageCard d={d} />
      ) : d.type === "disperse" ? (
        <DisperseCard d={d} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Deployment for <span className="capitalize">{d.type}</span> distributions lands in a later milestone.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Overview({ d }: { d: Distribution }) {
  const startTs = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const admin = typeof d.config.admin === "string" ? d.config.admin : d.creator
  const canExtend = d.config.canExtendClaimWindow === true
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Confidential token" value={<Mono>{d.token}</Mono>} />
        <Row
          label="Pool / contract"
          value={d.contractAddress ? <Mono>{d.contractAddress}</Mono> : <span className="text-muted-foreground">—</span>}
        />
        <Row
          label="Deploy tx"
          value={
            d.deployTxHash ? (
              <a className="font-mono text-xs underline" href={`${EXPLORER}/tx/${d.deployTxHash}`} target="_blank" rel="noreferrer">
                {shortAddr(d.deployTxHash)}
              </a>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <Row label="Creator" value={<Mono>{d.creator}</Mono>} />
        {d.type === "airdrop" && (
          <>
            <Row label="Admin" value={<Mono>{admin}</Mono>} />
            <Row label="Claim opens" value={startTs ? fmtTime(startTs) : "At deploy"} />
            <Row label="Claim closes" value={`${fmtTime(endTs)}${canExtend ? " · extendable" : ""}`} />
          </>
        )}
      </CardContent>
    </Card>
  )
}

function DeployCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { isConnected } = useAccount()
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const startTs = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const canExtend = d.config.canExtendClaimWindow === true
  const admin = (typeof d.config.admin === "string" ? d.config.admin : d.creator) as Address
  const now = Math.floor(Date.now() / 1000)
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

  const writeBack = async (airdrop: Address, hash: Hex) => {
    setPhase("Writing back…")
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
        <Button onClick={onDeploy} disabled={!isConnected || !fund || !!phase || !!scheduleError}>
          {phase ?? "Approve & deploy"}
        </Button>
        {scheduleError && <p className="text-sm text-destructive">{scheduleError}</p>}

        {deployed && !d.contractAddress && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
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
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

type Entry = { recipient: Address; amount: bigint }

// Parse a "address, amount" textarea into validated, de-duplicated entries.
function parseEntries(text: string, decimals: number): { entries: Entry[]; errors: string[] } {
  const entries: Entry[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [addr, amt] = line.split(/[,\s]+/)
      if (!addr || !isAddress(addr)) {
        errors.push(`Line ${i + 1}: invalid address`)
        return
      }
      if (!amt || !(Number(amt) > 0)) {
        errors.push(`Line ${i + 1}: invalid amount`)
        return
      }
      const key = addr.toLowerCase()
      if (seen.has(key)) {
        errors.push(`Line ${i + 1}: duplicate ${shortAddr(addr)}`)
        return
      }
      seen.add(key)
      try {
        entries.push({ recipient: getAddress(addr), amount: parseUnits(amt, decimals) })
      } catch {
        errors.push(`Line ${i + 1}: bad amount`)
      }
    })
  return { entries, errors }
}

function IssueCard({ d }: { d: Distribution }) {
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
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      // Drop a header row if the first cell isn't an address.
      if (lines[0] && !isAddress(lines[0].split(/[,\s]+/)[0])) lines.shift()
      setInput((v) => (v ? `${v}\n` : "") + lines.join("\n"))
    }
    reader.readAsText(file)
  }

  const recipientsQ = useQuery({ queryKey: ["recipients", d.id], queryFn: () => listRecipients(d.id) })
  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const issued = new Set((recipientsQ.data ?? []).map((r) => r.recipient.toLowerCase()))
  const fresh = entries.filter((e) => !issued.has(e.recipient.toLowerCase()))

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
                One <span className="font-mono">address, amount</span> per line, or upload a CSV. Encrypted &amp; signed
                per recipient, in your browser.
              </CardDescription>
            </div>
            {d.status === "funded" && (
              <Button size="sm" variant="outline" onClick={goLive}>
                Publish (go live)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-28 w-full rounded-lg border bg-transparent p-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={"0xRecipient…, 100\n0xAnother…, 250"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button
              variant="ghost"
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
            <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()}>
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
          <Button onClick={onIssue} disabled={!airdrop || fresh.length === 0 || !!progress}>
            {progress ?? (fresh.length ? `Issue ${fresh.length} claim${fresh.length === 1 ? "" : "s"}` : "Issue claims")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {d.status === "live" && (
            <p className="text-sm text-muted-foreground">
              Recipients claim at{" "}
              <a className="font-mono underline" href={`/claim/${d.slug}`}>
                /claim/{d.slug}
              </a>
            </p>
          )}
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
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
              <span className="font-mono">{shortAddr(r.recipient)}</span>
              <span className="font-mono text-xs text-muted-foreground">🔒 {shortAddr(r.handle)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function numberConfig(d: Distribution, key: string, fallback: number): number {
  const v = d.config[key]
  return typeof v === "number" ? v : fallback
}

function VestingTerms({ d }: { d: Distribution }) {
  const cliffDays = Math.round(numberConfig(d, "cliffSeconds", 0) / 86_400)
  const intervalDays = Math.round(numberConfig(d, "releaseIntervalSecs", 86_400) / 86_400)
  const initialPct = numberConfig(d, "initialUnlockBps", 0) / 100
  return (
    <div className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2">
      <Row label="Vesting starts" value={fmtTime(numberConfig(d, "startTimestamp", 0))} />
      <Row label="Vesting ends" value={fmtTime(numberConfig(d, "endTimestamp", 0))} />
      <Row label="Cliff" value={`${cliffDays} day${cliffDays === 1 ? "" : "s"}`} />
      <Row label="Release interval" value={`${intervalDays} day${intervalDays === 1 ? "" : "s"}`} />
      <Row label="Initial unlock" value={`${initialPct}%`} />
      <Row label="Revocable" value={d.config.isRevocable === true ? "Yes" : "No"} />
    </div>
  )
}

function VestingDeployCard({ d }: { d: Distribution }) {
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
        <VestingTerms d={d} />
        <Button onClick={onDeploy} disabled={!isConnected || !!phase}>
          {phase ?? "Deploy manager"}
        </Button>
        {deployed && !d.contractAddress && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
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
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

function VestingManageCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const manager = d.contractAddress as Address
  const decimals = numberConfig(d, "decimals", 6)
  const approve = useConfidentialApprove({ tokenAddress: d.token as Address })
  const createVesting = useCreateVesting({ address: manager, encryptor: () => sdk.relayer })
  const recipientsQ = useAllRecipients({ address: manager })

  const [input, setInput] = useState("")
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines[0] && !isAddress(lines[0].split(/[,\s]+/)[0])) lines.shift()
      setInput((v) => (v ? `${v}\n` : "") + lines.join("\n"))
    }
    reader.readAsText(file)
  }

  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const existing = new Set((recipientsQ.data ?? []).map((r) => r.toLowerCase()))
  const fresh = entries.filter((e) => !existing.has(e.recipient.toLowerCase()))

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
      for (let i = 0; i < fresh.length; i++) {
        setProgress(`Creating vesting ${i + 1}/${fresh.length}…`)
        await createVesting.mutateAsync({ params: vestingParams(fresh[i].recipient), amount: fresh[i].amount })
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
                One <span className="font-mono">address, amount</span> per line, or upload a CSV. Each creates an
                on-chain vesting funded from your confidential balance.
              </CardDescription>
            </div>
            {d.status !== "live" && (
              <Button size="sm" variant="outline" onClick={goLive}>
                Publish (go live)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <VestingTerms d={d} />
          <textarea
            className="min-h-28 w-full rounded-lg border bg-transparent p-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={"0xRecipient…, 100\n0xAnother…, 250"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Button
              variant="ghost"
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
            <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()}>
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
          <Button onClick={onAdd} disabled={fresh.length === 0 || !!progress}>
            {progress ?? (fresh.length ? `Create ${fresh.length} vesting${fresh.length === 1 ? "" : "s"}` : "Create vestings")}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {d.status === "live" && (
            <p className="text-sm text-muted-foreground">
              Recipients claim at{" "}
              <a className="font-mono underline" href={`/claim/${d.slug}`}>
                /claim/{d.slug}
              </a>
            </p>
          )}
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
              <span className="text-xs text-muted-foreground">🔒 vesting</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <VestingDisclosureCard d={d} />
    </div>
  )
}

const DISCLOSURE_TYPES = [
  { value: DisclosureType.TotalAllocation, label: "Total allocation" },
  { value: DisclosureType.VestedAmount, label: "Vested amount" },
  { value: DisclosureType.ClaimableAmount, label: "Claimable amount" },
  { value: DisclosureType.SettledAmount, label: "Settled (claimed) amount" },
]

function VestingDisclosureCard({ d }: { d: Distribution }) {
  const manager = d.contractAddress as Address
  const recipientsQ = useAllRecipients({ address: manager })
  const [recipient, setRecipient] = useState("")
  const [party, setParty] = useState("")
  const [dtype, setDtype] = useState<DisclosureType>(DisclosureType.TotalAllocation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [shared, setShared] = useState<string>()

  const vestingsQ = useRecipientVestings({
    address: manager,
    recipient: isAddress(recipient) ? (recipient as Address) : undefined,
  })
  const vestingId = vestingsQ.data?.[0]
  const disclose = useAdminDiscloseToParty({ address: manager })

  const onDisclose = async () => {
    setError(undefined)
    if (!vestingId || !isAddress(party)) return
    setBusy(true)
    try {
      await disclose.mutateAsync({ vestingId, party: party as Address, disclosureType: dtype })
      toast.success("Disclosed to auditor — read-only & irreversible")
      setShared(`/audit?manager=${manager}&vesting=${vestingId}&type=${dtype}`)
      setParty("")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setBusy(false)
    }
  }

  const selectCls =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="disc-recipient">Recipient</Label>
            <select id="disc-recipient" className={selectCls} value={recipient} onChange={(e) => setRecipient(e.target.value)}>
              <option value="">Select recipient…</option>
              {recipientsQ.data?.map((r) => (
                <option key={r} value={r}>
                  {shortAddr(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="disc-type">Disclose</Label>
            <select id="disc-type" className={selectCls} value={dtype} onChange={(e) => setDtype(Number(e.target.value) as DisclosureType)}>
              {DISCLOSURE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-party">Auditor address</Label>
          <Input id="disc-party" placeholder="0x…" value={party} onChange={(e) => setParty(e.target.value.trim())} />
        </div>
        <Button onClick={onDisclose} disabled={!vestingId || !isAddress(party) || busy}>
          {busy ? "Disclosing…" : "Disclose to auditor"}
        </Button>
        {isAddress(recipient) && !vestingsQ.isLoading && !vestingId && (
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

function DisperseCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const decimals = numberConfig(d, "decimals", 6)
  const approve = useConfidentialApprove({ tokenAddress: d.token as Address })
  const disperse = useDisperse({ encryptor: () => sdk.relayer })

  const [input, setInput] = useState("")
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)

  const loadCsv = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines[0] && !isAddress(lines[0].split(/[,\s]+/)[0])) lines.shift()
      setInput((v) => (v ? `${v}\n` : "") + lines.join("\n"))
    }
    reader.readAsText(file)
  }

  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const done = d.status === "completed"

  const onDisperse = async () => {
    setError(undefined)
    if (entries.length === 0) return
    try {
      // Direct mode: approve the singleton as operator, then send in one encrypted batch.
      setProgress("Approving operator…")
      await approve.mutateAsync({ spender: DISPERSE_SINGLETON, until: Math.floor(Date.now() / 1000) + 86_400 })
      setProgress(`Dispersing to ${entries.length}…`)
      const res = await disperse.mutateAsync({
        token: d.token as Address,
        mode: "direct",
        recipients: entries.map((e) => e.recipient),
        amounts: entries.map((e) => e.amount),
      })
      await patchDistribution(d.id, { status: "completed", deployTxHash: res.hash })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
      setInput("")
      toast.success(`Dispersed to ${entries.length} recipient${entries.length === 1 ? "" : "s"}`)
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disperse</CardTitle>
        <CardDescription>
          One <span className="font-mono">address, amount</span> per line, or upload a CSV. Sends from your
          confidential balance in a single encrypted batch — recipients receive instantly, no claim.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {done ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
            Dispersed ✓ — recipients received tokens into their confidential balance.
            {d.deployTxHash && (
              <>
                {" "}
                <a className="underline" href={`${EXPLORER}/tx/${d.deployTxHash}`} target="_blank" rel="noreferrer">
                  View tx
                </a>
              </>
            )}
          </div>
        ) : (
          <>
            <textarea
              className="min-h-28 w-full rounded-lg border bg-transparent p-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={"0xRecipient…, 100\n0xAnother…, 250"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Button
                variant="ghost"
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
              <Button variant="ghost" size="sm" type="button" onClick={() => fileRef.current?.click()}>
                Upload CSV
              </Button>
              <span className="text-muted-foreground">
                {entries.length} recipient{entries.length === 1 ? "" : "s"}
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
            <Button onClick={onDisperse} disabled={entries.length === 0 || !!progress}>
              {progress ?? (entries.length ? `Disperse to ${entries.length}` : "Disperse")}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>
}
