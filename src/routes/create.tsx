import { useState, type ReactNode } from "react"
import { Send, CalendarClock, Split, FilePlus2, type LucideIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"
import { isAddress, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useIsConfidential } from "@zama-fhe/react-sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateTimePicker } from "@/components/ui/datetime-picker"
import { Kicker, Folio, Notice } from "@/components/editorial"
import { FeeDisclosure } from "@/components/fee-disclosure"
import { VestingTimeline } from "@/components/vesting-timeline"
import { cn } from "@/lib/utils"
import { fmtTime, slugify } from "@/lib/format"
import { useNowSeconds } from "@/lib/use-now"
import { useTokenMeta } from "@/lib/tokens"
import { createDistribution, type DistributionType } from "@/lib/api"

const TYPES: { id: DistributionType; title: string; blurb: string; ready: boolean; icon: LucideIcon }[] = [
  { id: "airdrop", title: "Airdrop", blurb: "Signature-authorized claims with encrypted per-recipient amounts.", ready: true, icon: Send },
  { id: "vesting", title: "Vesting", blurb: "Linear unlock with cliff & initial release, claimed over time.", ready: true, icon: CalendarClock },
  { id: "disperse", title: "Disperse", blurb: "One-shot batch payout — recipients receive directly, no claim.", ready: true, icon: Split },
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
  const [splitEnabled, setSplitEnabled] = useState(false)

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
  const vestingDuration = startTs !== null && endTs !== null && endTs > startTs ? endTs - startTs : null
  const scheduleErrors = {
    start:
      type === "vesting" && startTs === null
        ? "Pick a vesting start."
        : type === "vesting" && startTs !== null && endTs !== null && endTs <= startTs
          ? "Start must be before the end."
          : undefined,
    end:
      type === "vesting" && endTs === null
        ? "Pick a vesting end."
        : type === "vesting" && endTs !== null && endTs <= now
          ? "End must be in the future."
          : type === "vesting" && startTs !== null && endTs !== null && endTs <= startTs
            ? "End must be after the start."
            : undefined,
    cliff:
      type === "vesting" && (!Number.isFinite(cliffDaysN) || cliffDaysN < 0)
        ? "Use 0 or more days."
        : type === "vesting" && vestingDuration !== null && cliffDaysN * 86_400 > vestingDuration
          ? "Cliff cannot exceed the vesting duration."
          : undefined,
    cliffAmount:
      type === "vesting" && (!Number.isFinite(cliffAmountPctN) || cliffAmountPctN < 0)
        ? "Use 0% or more."
        : type === "vesting" && initialPctN + cliffAmountPctN > 100
          ? "Initial + cliff unlock cannot exceed 100%."
          : undefined,
    interval:
      type === "vesting" && (!Number.isFinite(intervalDaysN) || intervalDaysN < 1)
        ? "Use at least 1 day."
        : undefined,
    initial:
      type === "vesting" && (!Number.isFinite(initialPctN) || initialPctN < 0)
        ? "Use 0% or more."
        : type === "vesting" && initialPctN + cliffAmountPctN > 100
          ? "Initial + cliff unlock cannot exceed 100%."
          : undefined,
    timelock:
      type === "vesting" && (!Number.isFinite(timelockDaysN) || timelockDaysN < 0)
        ? "Use 0 or more days."
        : undefined,
  }
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
  const vestingPreview =
    startTs !== null &&
    endTs !== null &&
    endTs > startTs &&
    Number.isFinite(cliffDaysN) &&
    cliffDaysN >= 0 &&
    Number.isFinite(intervalDaysN) &&
    intervalDaysN >= 1 &&
    Number.isFinite(initialPctN) &&
    initialPctN >= 0 &&
    Number.isFinite(cliffAmountPctN) &&
    cliffAmountPctN >= 0 &&
    initialPctN + cliffAmountPctN <= 100
      ? {
          start: startTs,
          end: endTs,
          cliffSeconds: Math.round(cliffDaysN * 86_400),
          releaseIntervalSecs: Math.round(intervalDaysN * 86_400),
          initialUnlockBps: Math.round(initialPctN * 100),
          cliffAmountBps: Math.round(cliffAmountPctN * 100),
        }
      : undefined

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
                splitEnabled,
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

  const normalizedSlug = slugify(slug)
  const baseValid =
    isConnected && !!name.trim() && !!normalizedSlug && validToken && isConfidential && tokenMeta.decimals !== undefined
  const canSubmit =
    baseValid && (type === "airdrop" ? validWindow : type === "vesting" ? vestingValid : type === "disperse" ? true : false)
  const selectedType = TYPES.find((t) => t.id === type)
  const tokenLabel =
    !token
      ? "Paste a confidential token"
      : !validToken
        ? "Invalid address"
        : confCheck.isLoading
          ? "Checking token"
          : confCheck.data === false
            ? "Not confidential"
            : isConfidential && tokenMeta.symbol
              ? `${tokenMeta.symbol}${tokenMeta.name ? ` · ${tokenMeta.name}` : ""}`
              : isConfidential
                ? "Confidential token verified"
                : "Waiting for token check"
  const termsReady =
    type === "airdrop" ? validWindow : type === "vesting" ? vestingValid : type === "disperse" ? true : false
  const submitHint = !isConnected
    ? "Connect your wallet to create a distribution."
    : !type
      ? "Choose an instrument first."
      : !name.trim()
        ? "Name the distribution."
        : !normalizedSlug
          ? "Set a public slug."
          : !validToken || !isConfidential || tokenMeta.decimals === undefined
            ? "Verify a confidential ERC-7984 token."
            : !termsReady
              ? "Complete the terms before creating the draft."
              : "Draft will open on the distribution detail page for deployment and recipients."

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <Kicker>Create</Kicker>
        <h1 className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-tight text-foreground">New distribution</h1>
        <p className="font-sans text-muted-foreground">
          Choose an instrument, name it, and point it at a confidential token. Amounts are encrypted in your browser.
        </p>
      </header>

      {/* Instrument */}
      <section className="space-y-4">
        <Kicker>Instrument</Kicker>
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
                <Folio>0{i + 1}</Folio>
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors",
                    type === t.id ? "bg-seal" : "ring-1 ring-border ring-inset",
                  )}
                  aria-hidden
                />
              </div>
              <h3 className="font-display mt-3 flex items-center gap-2 text-xl tracking-tight text-foreground">
                <t.icon className={cn("size-5", type === t.id ? "text-foreground" : "text-muted-foreground")} aria-hidden />
                {t.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.blurb}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          {/* Details */}
          <section className={cn("space-y-4", !type && "opacity-50")} aria-disabled={!type}>
            <Kicker>Details</Kicker>
            <Card>
              <CardHeader>
                <CardTitle>Name, link, and token</CardTitle>
                <CardDescription>
                  This creates the distribution record. Deployment and recipients happen next, on the detail page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="Series A investor airdrop"
                    value={name}
                    onChange={(e) => onName(e.target.value)}
                    disabled={!type}
                  />
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
                    Public claim link · <span className="font-mono">/claim/{normalizedSlug || "your-slug"}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">Confidential token</Label>
                  <Input
                    id="token"
                    placeholder="0x… (ERC-7984 address)"
                    value={token}
                    onChange={(e) => setToken(e.target.value.trim())}
                    disabled={!type}
                  />
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
                  <p className="text-xs text-muted-foreground">
                    Need one?{" "}
                    <a className="underline decoration-border underline-offset-2 hover:decoration-foreground" href="/wrap">
                      Wrap an ERC-20 first
                    </a>
                    .
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Terms */}
          <section className={cn("space-y-4", !type && "opacity-50")} aria-disabled={!type}>
            <Kicker>Terms</Kicker>
            <Card>
              <CardHeader>
                <CardTitle>{selectedType ? `${selectedType.title} terms` : "Distribution terms"}</CardTitle>
                <CardDescription>
                  Terms define the claim window or vesting schedule. Recipients and encrypted amounts are added after the
                  draft is created.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!type && <Notice tone="muted">Choose an instrument to see the terms this distribution needs.</Notice>}

                {type === "airdrop" && (
                  <div className="space-y-4">
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
                          <p className="text-sm text-destructive">
                            Must be in the future{start ? " and after the open time" : ""}.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm text-foreground">
                      <Checkbox id="can-extend" checked={canExtend} onCheckedChange={(v) => setCanExtend(v === true)} />
                      <Label htmlFor="can-extend" className="font-normal">
                        Allow extending the claim window later
                      </Label>
                    </div>
                  </div>
                )}

                {type === "vesting" && (
                  <div className="space-y-4">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="vstart">Vesting starts</Label>
                          <DateTimePicker
                            id="vstart"
                            value={start}
                            onChange={setStart}
                            placeholder="Pick start"
                            aria-invalid={!!scheduleErrors.start}
                            aria-describedby={scheduleErrors.start ? "vstart-error" : undefined}
                          />
                          <FieldError id="vstart-error" message={scheduleErrors.start} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vend">Vesting ends</Label>
                          <DateTimePicker
                            id="vend"
                            value={end}
                            onChange={setEnd}
                            placeholder="Pick end"
                            aria-invalid={!!scheduleErrors.end}
                            aria-describedby={scheduleErrors.end ? "vend-error" : undefined}
                          />
                          <FieldError id="vend-error" message={scheduleErrors.end} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cliff">Cliff (days)</Label>
                          <Input
                            id="cliff"
                            inputMode="numeric"
                            value={cliffDays}
                            onChange={(e) => setCliffDays(e.target.value)}
                            aria-invalid={!!scheduleErrors.cliff}
                            aria-describedby={scheduleErrors.cliff ? "cliff-error" : undefined}
                          />
                          <FieldError id="cliff-error" message={scheduleErrors.cliff} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cliff-unlock">Cliff unlock (%)</Label>
                          <Input
                            id="cliff-unlock"
                            inputMode="decimal"
                            value={cliffAmountPct}
                            onChange={(e) => setCliffAmountPct(e.target.value)}
                            aria-invalid={!!scheduleErrors.cliffAmount}
                            aria-describedby={scheduleErrors.cliffAmount ? "cliff-unlock-error" : undefined}
                          />
                          <FieldError id="cliff-unlock-error" message={scheduleErrors.cliffAmount} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="interval">Release interval (days)</Label>
                          <Input
                            id="interval"
                            inputMode="numeric"
                            value={intervalDays}
                            onChange={(e) => setIntervalDays(e.target.value)}
                            aria-invalid={!!scheduleErrors.interval}
                            aria-describedby={scheduleErrors.interval ? "interval-error" : undefined}
                          />
                          <FieldError id="interval-error" message={scheduleErrors.interval} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="initial">Initial unlock (%)</Label>
                          <Input
                            id="initial"
                            inputMode="decimal"
                            value={initialUnlockPct}
                            onChange={(e) => setInitialUnlockPct(e.target.value)}
                            aria-invalid={!!scheduleErrors.initial}
                            aria-describedby={scheduleErrors.initial ? "initial-error" : undefined}
                          />
                          <FieldError id="initial-error" message={scheduleErrors.initial} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timelock">Timelock (days)</Label>
                          <Input
                            id="timelock"
                            inputMode="numeric"
                            value={timelockDays}
                            onChange={(e) => setTimelockDays(e.target.value)}
                            aria-invalid={!!scheduleErrors.timelock}
                            aria-describedby={scheduleErrors.timelock ? "timelock-error" : undefined}
                          />
                          <FieldError id="timelock-error" message={scheduleErrors.timelock} />
                        </div>
                        <div className="flex items-center gap-2.5 pb-2 text-sm text-foreground">
                          <Checkbox id="revocable" checked={revocable} onCheckedChange={(v) => setRevocable(v === true)} />
                          <Label htmlFor="revocable" className="font-normal">
                            Revocable by admin
                          </Label>
                        </div>
                        <div className="flex items-center gap-2.5 pb-2 text-sm text-foreground">
                          <Checkbox
                            id="split-enabled"
                            checked={splitEnabled}
                            onCheckedChange={(v) => setSplitEnabled(v === true)}
                          />
                          <Label htmlFor="split-enabled" className="font-normal">
                            Allow recipients to split
                          </Label>
                        </div>
                      </div>

                      <div className="rounded-md border border-border bg-muted/20 p-3">
                        {vestingPreview ? (
                          <VestingTimeline {...vestingPreview} />
                        ) : (
                          <div className="flex min-h-64 flex-col justify-center rounded-sm border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                            <Kicker className="tracking-[0.12em]">Vesting timeline</Kicker>
                            <p className="mt-3 leading-relaxed">
                              Add a valid start, end, cliff, interval, and unlock percentages to preview the release shape.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These terms apply to every recipient; you add recipients (with per-recipient amounts) after deploying.
                      Initial unlock releases at start, cliff unlock releases when the cliff ends, the remainder vests linearly
                      each interval; timelock delays when released tokens become claimable.
                    </p>
                  </div>
                )}

                {type === "disperse" && (
                  <Notice tone="muted">
                    Disperse sends tokens directly to recipients in one batch — no claim step, no schedule. You'll add recipients
                    &amp; amounts after creating.
                  </Notice>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-28">
          <Kicker>Review</Kicker>
          <Card>
            <CardHeader>
              <CardTitle>Draft summary</CardTitle>
              <CardDescription>Confirm the setup before opening the deploy workflow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <ReviewRow label="Instrument" value={selectedType?.title ?? "Not selected"} ready={!!type} />
                <ReviewRow label="Name" value={name.trim() || "Untitled"} ready={!!name.trim()} />
                <ReviewRow label="Claim link" value={`/claim/${normalizedSlug || "your-slug"}`} ready={!!normalizedSlug} mono />
                <ReviewRow label="Token" value={tokenLabel} ready={validToken && isConfidential && tokenMeta.decimals !== undefined} />
                <ReviewRow
                  label="Terms"
                  value={
                    <div className="space-y-3">
                      <TermsSummary
                        type={type}
                        startTs={startTs}
                        endTs={endTs}
                        canExtend={canExtend}
                        cliffDays={cliffDays}
                        cliffAmountPct={cliffAmountPct}
                        intervalDays={intervalDays}
                        initialUnlockPct={initialUnlockPct}
                        timelockDays={timelockDays}
                        revocable={revocable}
                        splitEnabled={splitEnabled}
                      />
                      {type === "vesting" && vestingPreview && (
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <VestingTimeline {...vestingPreview} />
                        </div>
                      )}
                    </div>
                  }
                  ready={termsReady}
                />
              </div>

              {type && address && <FeeDisclosure type={type} creator={address} />}

              <div className="space-y-3 border-t border-border pt-4">
                <Button className="w-full" onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
                  <FilePlus2 />
                  {create.isPending ? "Creating draft…" : "Create draft"}
                </Button>
                <p className={cn("text-xs leading-relaxed", canSubmit ? "text-muted-foreground" : "text-destructive")}>
                  {submitHint}
                </p>
                {create.error && <p className="text-sm text-destructive">{err(create.error)}</p>}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs leading-relaxed text-destructive" role="alert">
      {message}
    </p>
  )
}

function ReviewRow({
  label,
  value,
  ready,
  mono,
}: {
  label: string
  value: ReactNode
  ready: boolean
  mono?: boolean
}) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <Kicker className="tracking-[0.12em]">{label}</Kicker>
        <span className={cn("size-1.5 rounded-full", ready ? "bg-seal" : "bg-muted-foreground")} aria-hidden />
      </div>
      <div className={cn("text-sm leading-relaxed text-foreground", mono && "font-mono text-xs break-all")}>
        {value}
      </div>
    </div>
  )
}

function TermsSummary({
  type,
  startTs,
  endTs,
  canExtend,
  cliffDays,
  cliffAmountPct,
  intervalDays,
  initialUnlockPct,
  timelockDays,
  revocable,
  splitEnabled,
}: {
  type?: DistributionType
  startTs: number | null
  endTs: number | null
  canExtend: boolean
  cliffDays: string
  cliffAmountPct: string
  intervalDays: string
  initialUnlockPct: string
  timelockDays: string
  revocable: boolean
  splitEnabled: boolean
}) {
  if (!type) return <>Choose an instrument.</>
  if (type === "disperse") return <>Direct encrypted batch. No claim page or schedule.</>
  if (type === "airdrop") {
    return (
      <>
        Opens {startTs ? fmtTime(startTs) : "at deploy"} · closes {endTs ? fmtTime(endTs) : "not set"}
        {canExtend ? " · extendable" : ""}
      </>
    )
  }
  return (
    <>
      {startTs ? fmtTime(startTs) : "Start not set"} → {endTs ? fmtTime(endTs) : "end not set"} ·{" "}
      {initialUnlockPct}% initial · {cliffDays}d cliff / {cliffAmountPct}% · every {intervalDays}d
      {timelockDays !== "0" ? ` · ${timelockDays}d timelock` : ""}
      {revocable ? " · revocable" : ""}
      {splitEnabled ? " · splitting allowed" : ""}
    </>
  )
}
