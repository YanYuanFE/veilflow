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
import { DateTimePicker } from "@/components/ui/datetime-picker"
import { Kicker, Folio, Notice } from "@/components/editorial"
import { FeeDisclosure } from "@/components/fee-disclosure"
import { cn } from "@/lib/utils"
import { slugify } from "@/lib/format"
import { useNowSeconds } from "@/lib/use-now"
import { useTokenMeta } from "@/lib/tokens"
import { createDistribution, type DistributionType } from "@/lib/api"

const TYPES: { id: DistributionType; title: string; blurb: string; ready: boolean }[] = [
  { id: "airdrop", title: "Airdrop", blurb: "Signature-authorized claims with encrypted per-recipient amounts.", ready: true },
  { id: "vesting", title: "Vesting", blurb: "Linear unlock with cliff & initial release, claimed over time.", ready: true },
  { id: "disperse", title: "Disperse", blurb: "One-shot batch payout — recipients receive directly, no claim.", ready: true },
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
  const [cliffAmountPct, setCliffAmountPct] = useState("0")
  const [intervalDays, setIntervalDays] = useState("30")
  const [initialUnlockPct, setInitialUnlockPct] = useState("0")
  const [timelockDays, setTimelockDays] = useState("0")
  const [revocable, setRevocable] = useState(false)

  const validToken = isAddress(token)
  const confCheck = useIsConfidential(validToken ? (token as Address) : ZERO, { enabled: validToken })
  const isConfidential = confCheck.data === true
  const tokenMeta = useTokenMeta(validToken && isConfidential ? (token as Address) : undefined)
  const now = useNowSeconds()
  const startTs = start ? Math.floor(new Date(start).getTime() / 1000) : null
  const endTs = end ? Math.floor(new Date(end).getTime() / 1000) : null
  const validWindow = endTs !== null && endTs > now && (startTs === null || endTs > startTs)

  const cliffDaysN = Number(cliffDays)
  const cliffAmountPctN = Number(cliffAmountPct)
  const intervalDaysN = Number(intervalDays)
  const initialPctN = Number(initialUnlockPct)
  const timelockDaysN = Number(timelockDays)
  const vestingValid =
    startTs !== null &&
    endTs !== null &&
    endTs > startTs &&
    endTs > now &&
    Number.isFinite(cliffDaysN) && cliffDaysN >= 0 && cliffDaysN * 86_400 <= endTs - startTs &&
    Number.isFinite(intervalDaysN) && intervalDaysN >= 1 &&
    Number.isFinite(initialPctN) && initialPctN >= 0 &&
    Number.isFinite(cliffAmountPctN) && cliffAmountPctN >= 0 &&
    initialPctN + cliffAmountPctN <= 100 &&
    Number.isFinite(timelockDaysN) && timelockDaysN >= 0

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
                timelockSeconds: Math.round(timelockDaysN * 86_400),
                initialUnlockBps: Math.round(initialPctN * 100),
                cliffAmountBps: Math.round(cliffAmountPctN * 100),
                isRevocable: revocable,
              }
            : type === "disperse"
              ? { decimals: tokenMeta.decimals!, mode: "direct" }
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
  const canSubmit =
    baseValid && (type === "airdrop" ? validWindow : type === "vesting" ? vestingValid : type === "disperse" ? true : false)

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <Kicker>Create</Kicker>
        <h1 className="font-display text-[clamp(2rem,4vw,2.75rem)] leading-tight text-foreground">New distribution</h1>
        <p className="font-serif text-muted-foreground">
          Choose an instrument, name it, and point it at a confidential token. Amounts are encrypted in your browser.
        </p>
      </header>

      {/* Step 1 — instrument */}
      <section className="space-y-4">
        <Kicker>№ 01 · Choose an instrument</Kicker>
        <div className="grid gap-3 sm:grid-cols-3">
          {TYPES.map((t, i) => (
            <button
              key={t.id}
              type="button"
              disabled={!t.ready}
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={cn(
                "group rounded-md border p-5 text-left transition-colors",
                t.ready ? "hover:bg-muted/40" : "cursor-not-allowed opacity-55",
                type === t.id ? "border-foreground bg-muted/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <Folio>№ 0{i + 1}</Folio>
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    type === t.id ? "bg-seal" : "ring-1 ring-border ring-inset",
                  )}
                  aria-hidden
                />
              </div>
              <h3 className="font-display mt-3 text-xl tracking-tight text-foreground">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Step 2 — details */}
      <section className={cn("space-y-4", !type && "opacity-50")} aria-disabled={!type}>
        <Kicker>№ 02 · Details</Kicker>
        <div className="space-y-5 rounded-md border border-border bg-card p-6">
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
            <p className="text-xs text-muted-foreground">
              Public claim link · <span className="font-mono">/claim/{slug || "your-slug"}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Confidential token</Label>
            <Input id="token" placeholder="0x… (ERC-7984 address)" value={token} onChange={(e) => setToken(e.target.value.trim())} disabled={!type} />
            {token && !validToken && <p className="text-sm text-destructive">Invalid address.</p>}
            {validToken && confCheck.isLoading && <p className="text-xs text-muted-foreground">Checking token…</p>}
            {validToken && confCheck.data === false && (
              <p className="text-sm text-destructive">
                Not a confidential ERC-7984 token. Use a confidential token address (e.g. cUSDT 0x4E7B…4491).
              </p>
            )}
            {validToken && confCheck.error && <p className="text-sm text-destructive">Couldn't verify token: {confCheck.error.message}</p>}
            {validToken && isConfidential && tokenMeta.symbol && (
              <p className="text-xs text-muted-foreground">
                ✓ {tokenMeta.symbol}
                {tokenMeta.name ? ` · ${tokenMeta.name}` : ""} · {tokenMeta.decimals} decimals
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Need one?{" "}
              <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href="/wrap">
                Wrap an ERC-20 first
              </a>
              .
            </p>
          </div>

          {type === "airdrop" && (
            <div className="space-y-4 border-t border-border pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start">Claim opens</Label>
                  <DateTimePicker id="start" value={start} onChange={setStart} placeholder="Opens at deploy" />
                  <p className="text-xs text-muted-foreground">Leave empty = opens the moment it's deployed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">Claim closes</Label>
                  <DateTimePicker id="end" value={end} onChange={setEnd} placeholder="Pick close time" />
                  {end && !validWindow && (
                    <p className="text-sm text-destructive">Must be in the future{start ? " and after the open time" : ""}.</p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-foreground">
                <input type="checkbox" className="size-4 accent-seal" checked={canExtend} onChange={(e) => setCanExtend(e.target.checked)} />
                Allow extending the claim window later
              </label>
            </div>
          )}

          {type === "vesting" && (
            <div className="space-y-4 border-t border-border pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vstart">Vesting starts</Label>
                  <DateTimePicker id="vstart" value={start} onChange={setStart} placeholder="Pick start" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vend">Vesting ends</Label>
                  <DateTimePicker id="vend" value={end} onChange={setEnd} placeholder="Pick end" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliff">Cliff (days)</Label>
                  <Input id="cliff" inputMode="numeric" value={cliffDays} onChange={(e) => setCliffDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cliff-unlock">Cliff unlock (%)</Label>
                  <Input id="cliff-unlock" inputMode="decimal" value={cliffAmountPct} onChange={(e) => setCliffAmountPct(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">Release interval (days)</Label>
                  <Input id="interval" inputMode="numeric" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial">Initial unlock (%)</Label>
                  <Input id="initial" inputMode="decimal" value={initialUnlockPct} onChange={(e) => setInitialUnlockPct(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timelock">Timelock (days)</Label>
                  <Input id="timelock" inputMode="numeric" value={timelockDays} onChange={(e) => setTimelockDays(e.target.value)} />
                </div>
                <label className="flex items-end gap-2.5 pb-2 text-sm text-foreground">
                  <input type="checkbox" className="size-4 accent-seal" checked={revocable} onChange={(e) => setRevocable(e.target.checked)} />
                  Revocable by admin
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                These terms apply to every recipient; you add recipients (with per-recipient amounts) after deploying. Initial
                unlock releases at start, cliff unlock releases when the cliff ends, the remainder vests linearly each interval;
                timelock delays when released tokens become claimable.
              </p>
              {(start || end || cliffDays !== "0" || initialUnlockPct !== "0" || cliffAmountPct !== "0" || timelockDays !== "0") &&
                !vestingValid && (
                  <p className="text-sm text-destructive">
                    Check the schedule: end after start &amp; in the future, cliff ≤ duration, interval ≥ 1 day, initial + cliff
                    unlock 0–100%, timelock ≥ 0.
                  </p>
                )}
            </div>
          )}

          {type === "disperse" && (
            <Notice tone="muted">
              Disperse sends tokens directly to recipients in one batch — no claim step, no schedule. You'll add recipients
              &amp; amounts after creating.
            </Notice>
          )}

          {type && address && <FeeDisclosure type={type} creator={address} />}

          <div className="flex items-center gap-4 border-t border-border pt-5">
            <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
              {create.isPending ? "Creating draft…" : "Create draft"}
            </Button>
            {!isConnected && <span className="text-sm text-muted-foreground">Connect your wallet to create a distribution.</span>}
          </div>
          {create.error && <p className="text-sm text-destructive">{err(create.error)}</p>}
        </div>
      </section>
    </div>
  )
}
