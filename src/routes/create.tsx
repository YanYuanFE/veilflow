import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { isAddress, type Address } from "viem"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/format"
import { createDistribution, type DistributionType } from "@/lib/api"

const TYPES: { id: DistributionType; title: string; blurb: string; ready: boolean }[] = [
  { id: "airdrop", title: "Airdrop", blurb: "Signature-authorized claims with encrypted per-recipient amounts.", ready: true },
  { id: "vesting", title: "Vesting", blurb: "Linear unlock with selective disclosure for auditors.", ready: false },
  { id: "disperse", title: "Disperse", blurb: "One-shot batch payout, encrypted in a single proof.", ready: false },
]

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
  const [durationDays, setDurationDays] = useState("30")
  const [canExtend, setCanExtend] = useState(false)

  const validToken = isAddress(token)
  const days = Number(durationDays)
  const validDays = Number.isFinite(days) && days > 0

  const create = useMutation({
    mutationFn: () =>
      createDistribution({
        name: name.trim(),
        slug: slugify(slug),
        type: type!,
        creator: address!,
        token: token as Address,
        config: { decimals: 6, durationDays: days, canExtendClaimWindow: canExtend },
      }),
    onSuccess: (d) => navigate(`/d/${d.id}`),
  })

  const onName = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  const canSubmit = isConnected && type === "airdrop" && name.trim() && slug && validToken && validDays

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
          </div>

          {type === "airdrop" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="days">Claim window (days)</Label>
                <Input id="days" inputMode="numeric" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
              </div>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" checked={canExtend} onChange={(e) => setCanExtend(e.target.checked)} />
                Allow extending the claim window
              </label>
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
