import { useState, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { isAddress, parseUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { useZamaSDK, useConfidentialApprove } from "@zama-fhe/react-sdk"
import { encryptUint64 } from "@tokenops/sdk/fhe-airdrop"
import {
  useCreateAndFundConfidentialAirdropAndGetAddress,
  useSignClaimAuthorization,
} from "@tokenops/sdk/fhe-airdrop/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { shortAddr } from "@/lib/format"
import {
  getDistribution,
  patchDistribution,
  listRecipients,
  addRecipient,
  type Distribution,
} from "@/lib/api"

const FACTORY_SEPOLIA = "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" as Address
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

      {d.type !== "airdrop" ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Deployment for <span className="capitalize">{d.type}</span> distributions lands in a later milestone.
          </CardContent>
        </Card>
      ) : !isOwner ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Connect as the creator ({shortAddr(d.creator)}) to manage this distribution.
          </CardContent>
        </Card>
      ) : d.status === "draft" ? (
        <DeployCard d={d} />
      ) : (
        <IssueCard d={d} />
      )}
    </div>
  )
}

function Overview({ d }: { d: Distribution }) {
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
      </CardContent>
    </Card>
  )
}

function DeployCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { isConnected } = useAccount()
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const durationDays = typeof d.config.durationDays === "number" ? d.config.durationDays : 30
  const canExtend = d.config.canExtendClaimWindow === true

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
    if (!fund) return
    try {
      setPhase("Marking deploying…")
      await patchDistribution(d.id, { status: "deploying" })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })

      setPhase("Deploying & funding…")
      const now = Math.floor(Date.now() / 1000)
      const res = await create.mutateAsync({
        params: {
          token: d.token as Address,
          startTimestamp: now,
          endTimestamp: now + durationDays * 86_400,
          canExtendClaimWindow: canExtend,
          admin: d.creator as Address,
        },
        userSalt: randomSalt(),
        amount: parseUnits(fund, decimals),
      })
      setDeployed({ airdrop: res.airdrop, hash: res.hash })
      await writeBack(res.airdrop, res.hash)
    } catch (e) {
      setError(err(e))
      setPhase(undefined)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deploy &amp; fund</CardTitle>
        <CardDescription>
          Approve the factory as an operator, then deploy and fund the pool in one transaction. Claim
          window: {durationDays} days{canExtend ? " (extendable)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fund">Funding amount</Label>
          <Input id="fund" inputMode="decimal" placeholder="0.0" value={fund} onChange={(e) => setFund(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => approve.mutate({ spender: FACTORY_SEPOLIA, until: Math.floor(Date.now() / 1000) + 86_400 })}
            disabled={!isConnected || approve.isPending}
          >
            {approve.isPending ? "Approving…" : approve.isSuccess ? "Operator approved ✓" : "Approve factory"}
          </Button>
          <Button onClick={onDeploy} disabled={!isConnected || !fund || !!phase}>
            {phase ?? "Deploy & fund"}
          </Button>
        </div>

        {deployed && !d.contractAddress && (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p>Contract deployed on-chain ({shortAddr(deployed.airdrop)}) but the write-back didn't land.</p>
            <Button size="sm" variant="outline" onClick={() => writeBack(deployed.airdrop, deployed.hash).catch((e) => setError(err(e)))}>
              Retry write-back
            </Button>
          </div>
        )}
        {approve.error && <p className="text-sm text-destructive">{err(approve.error)}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

function IssueCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const decimals = typeof d.config.decimals === "number" ? d.config.decimals : 6
  const airdrop = d.contractAddress as Address | null

  const [recipient, setRecipient] = useState("")
  const [allocation, setAllocation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const sign = useSignClaimAuthorization()

  const recipientsQ = useQuery({
    queryKey: ["recipients", d.id],
    queryFn: () => listRecipients(d.id),
  })

  const goLive = async () => {
    await patchDistribution(d.id, { status: "live" })
    queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
  }

  const onIssue = async () => {
    setError(undefined)
    if (!airdrop || !isAddress(recipient) || !allocation) return
    setBusy(true)
    try {
      // Encryption happens here, in the issuer's browser — the plaintext amount never leaves it.
      const encryptedInput = await encryptUint64({
        encryptor: sdk.relayer,
        contractAddress: airdrop,
        userAddress: recipient as Address,
        value: parseUnits(allocation, decimals),
      })
      const signature = await sign.mutateAsync({
        airdropAddress: airdrop,
        recipient: recipient as Address,
        encryptedAmountHandle: encryptedInput.handle,
      })
      // Persist only the ciphertext artifact + address + signature. No plaintext amount.
      await addRecipient(d.id, {
        recipient: recipient as Address,
        handle: encryptedInput.handle,
        inputProof: encryptedInput.inputProof,
        signature,
      })
      setRecipient("")
      setAllocation("")
      queryClient.invalidateQueries({ queryKey: ["recipients", d.id] })
    } catch (e) {
      setError(err(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Issue claims</CardTitle>
              <CardDescription>Encrypt an allocation bound to a recipient, sign it, and store the ciphertext.</CardDescription>
            </div>
            {d.status === "funded" && (
              <Button size="sm" variant="outline" onClick={goLive}>
                Publish (go live)
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient address</Label>
            <div className="flex gap-2">
              <Input id="recipient" placeholder="0x…" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} />
              <Button variant="ghost" type="button" disabled={!address} onClick={() => address && setRecipient(address)}>
                Use mine
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc">Allocation amount</Label>
            <Input id="alloc" inputMode="decimal" placeholder="0.0" value={allocation} onChange={(e) => setAllocation(e.target.value)} />
          </div>
          <Button onClick={onIssue} disabled={!airdrop || !isAddress(recipient) || !allocation || busy}>
            {busy ? "Encrypting & signing…" : "Issue signed claim"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {d.status === "live" && (
            <p className="text-sm text-muted-foreground">
              Recipients claim at <span className="font-mono">/claim/{d.slug}</span> (page coming in a later milestone).
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
