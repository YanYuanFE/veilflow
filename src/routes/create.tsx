import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { isAddress, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useIsConfidential } from "@zama-fhe/react-sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/format"
import { useTokenMeta } from "@/lib/tokens"
import { createDistribution, type DistributionType } from "@/lib/api"

const TYPES: { id: DistributionType; title: string; blurb: string; ready: boolean }[] = [
  { id: "airdrop", title: "Airdrop", blurb: "Signature-authorized claims with encrypted per-recipient amounts.", ready: true },
  { id: "vesting", title: "Vesting", blurb: "Linear unlock with cliff & initial release, claimed over time.", ready: true },
  { id: "disperse", title: "Disperse", blurb: "One-shot batch payout, encrypted in a single proof.", ready: false },
]

const ZERO = "0x0000000000000000000000000000000000000000" as Address

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function Create() {
  const navigate = useNavigate()
  const { address, isConnected } = useAccount()

  const [type, setType] = useState<DistributionType>()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugEdited, setSlugEdited] = useState(false)
  const [token, setToken] = useState("")
  const [start, setStart] = useState("") // datetime-local; blank = opens at deploy
  const [end, setEnd] = useState("") // datetime-local; required
  const [canExtend, setCanExtend] = useState(false)
  // Vesting schedule (set once; applies to every recipient added later)
  const [cliffDays, setCliffDays] = useState("0")
  const [intervalDays, setIntervalDays] = useState("30")
  const [initialUnlockPct, setInitialUnlockPct] = useState("0")
  const [revocable, setRevocable] = useState(false)

  const validToken = isAddress(token)
  const confCheck = useIsConfidential(validToken ? (token as Address) : ZERO, { enabled: validToken })
  const isConfidential = confCheck.data === true
  const tokenMeta = useTokenMeta(validToken && isConfidential ? (token as Address) : undefined)
  const now = Math.floor(Date.now() / 1000)
  const startTs = start ? Math.floor(new Date(start).getTime() / 1000) : null
  const endTs = end ? Math.floor(new Date(end).getTime() / 1000) : null
  const validWindow = endTs !== null && endTs > now && (startTs === null || endTs > startTs)

  const cliffDaysN = Number(cliffDays)
  const intervalDaysN = Number(intervalDays)
  const initialPctN = Number(initialUnlockPct)
  const vestingValid =
    startTs !== null &&
    endTs !== null &&
    endTs > startTs &&
    endTs > now &&
    Number.isFinite(cliffDaysN) && cliffDaysN >= 0 && cliffDaysN * 86_400 <= endTs - startTs &&
    Number.isFinite(intervalDaysN) && intervalDaysN >= 1 &&
    Number.isFinite(initialPctN) && initialPctN >= 0 && initialPctN <= 100

  const create = useMutation({
    mutationFn: () =>
      createDistribution({
        name: name.trim(),
        slug: slugify(slug),
        type: type!,
        creator: address!,
        token: token as Address,
        config:
          type === "vesting"
            ? {
                decimals: tokenMeta.decimals!,
                startTimestamp: startTs,
                endTimestamp: endTs,
                cliffSeconds: Math.round(cliffDaysN * 86_400),
                releaseIntervalSecs: Math.round(intervalDaysN * 86_400),
                timelockSeconds: 0,
                initialUnlockBps: Math.round(initialPctN * 100),
                cliffAmountBps: 0,
                isRevocable: revocable,
              }
            : {
                decimals: tokenMeta.decimals!,
                startTimestamp: startTs,
                endTimestamp: endTs,
                canExtendClaimWindow: canExtend,
                admin: address!, // the connected wallet — signs every claim authorization
              },
      }),
    onSuccess: (d) => {
      toast.success("Draft created")
      navigate(`/d/${d.id}`)
    },
    onError: (e) => toast.error(err(e)),
  })

  const onName = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  const baseValid =
    isConnected && !!name.trim() && !!slug && validToken && isConfidential && tokenMeta.decimals !== undefined
  const canSubmit = baseValid && (type === "airdrop" ? validWindow : type === "vesting" ? vestingValid : false)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create a distribution</h1>
        <p className="text-muted-foreground">Pick a type, then name it and point it at a confidential token.</p>
      </div>

      {/* Step 1 — type */}
      <div className="grid gap-3 sm:grid-cols-3">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!t.ready}
            onClick={() => setType(t.id)}
            className={cn(
              "rounded-xl border p-4 text-left ring-1 ring-foreground/10 transition-colors",
              t.ready ? "hover:bg-muted" : "cursor-not-allowed opacity-55",
              type === t.id && "ring-2 ring-foreground/40 bg-muted",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.title}</span>
              {!t.ready && <span className="text-xs text-muted-foreground">soon</span>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
          </button>
        ))}
      </div>

      {/* Step 2 — details */}
      <Card className={type ? "" : "opacity-60"}>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>
            The confidential (ERC-7984) token to distribute. Need one?{" "}
            <a className="underline" href="/wrap">
              Wrap an ERC-20 first
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Series A investor airdrop" value={name} onChange={(e) => onName(e.target.value)} disabled={!type} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="series-a-airdrop"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true)
                // Permissive while typing (keep dashes); normalized on submit.
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
              }}
              disabled={!type}
            />
            <p className="text-xs text-muted-foreground">Used for the public claim link: /claim/{slug || "your-slug"}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="token">Confidential token address</Label>
            <Input id="token" placeholder="0x…" value={token} onChange={(e) => setToken(e.target.value.trim())} disabled={!type} />
            {token && !validToken && <p className="text-sm text-destructive">Invalid address.</p>}
            {validToken && confCheck.isLoading && <p className="text-xs text-muted-foreground">Checking token…</p>}
            {validToken && confCheck.data === false && (
              <p className="text-sm text-destructive">
                Not a confidential ERC-7984 token. Use a confidential token address (e.g. cUSDT 0x4E7B…4491).
              </p>
            )}
            {validToken && confCheck.error && (
              <p className="text-sm text-destructive">Couldn't verify token: {confCheck.error.message}</p>
            )}
            {validToken && isConfidential && tokenMeta.symbol && (
              <p className="text-xs text-muted-foreground">
                ✓ {tokenMeta.symbol}
                {tokenMeta.name ? ` · ${tokenMeta.name}` : ""} · {tokenMeta.decimals} decimals
              </p>
            )}
          </div>

          {type === "airdrop" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start">Claim opens</Label>
                  <Input id="start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Blank = opens the moment it's deployed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">Claim closes</Label>
                  <Input id="end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                  {end && !validWindow && (
                    <p className="text-sm text-destructive">Must be in the future{start ? " and after the open time" : ""}.</p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={canExtend} onChange={(e) => setCanExtend(e.target.checked)} />
                Allow extending the claim window later
              </label>
            </div>
          )}

          {type === "vesting" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vstart">Vesting starts</Label>
                  <Input id="vstart" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vend">Vesting ends</Label>
                  <Input id="vend" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliff">Cliff (days)</Label>
                  <Input id="cliff" inputMode="numeric" value={cliffDays} onChange={(e) => setCliffDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">Release interval (days)</Label>
                  <Input id="interval" inputMode="numeric" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial">Initial unlock (%)</Label>
                  <Input id="initial" inputMode="decimal" value={initialUnlockPct} onChange={(e) => setInitialUnlockPct(e.target.value)} />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={revocable} onChange={(e) => setRevocable(e.target.checked)} />
                  Revocable by admin
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                These terms apply to every recipient; you add recipients (with per-recipient amounts) after deploying.
              </p>
              {(start || end || cliffDays !== "0" || initialUnlockPct !== "0") && !vestingValid && (
                <p className="text-sm text-destructive">
                  Check the schedule: end after start &amp; in the future, cliff ≤ duration, interval ≥ 1 day, initial unlock 0–100%.
                </p>
              )}
            </div>
          )}

          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Creating draft…" : "Create draft"}
          </Button>
          {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to create a distribution.</p>}
          {create.error && <p className="text-sm text-destructive">{err(create.error)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
