import { type ReactNode, useState } from "react"
import {
  ArrowDown,
  Check,
  Coins,
  Copy,
  ExternalLink,
  Megaphone,
  Rocket,
  Send,
  Settings2,
  SlidersHorizontal,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge, TypeBadge } from "@/components/status-badge"
import { Kicker } from "@/components/editorial"
import { Loading } from "@/components/spinner"
import { Stepper } from "@/components/stepper"
import { ShareClaim } from "@/components/share-claim"
import { shortAddr, fmtTime } from "@/lib/format"
import { lifecycle } from "@/lib/lifecycle"
import { getDistribution, type Distribution } from "@/lib/api"
import { EXPLORER, numberConfig } from "./shared"
import { DeployCard, IssueCard, TopUpPoolCard, AdminCard, AirdropPauseRow } from "./airdrop-panel"
import { VestingDeployCard, VestingManageCard, VestingPauseRow, VestingScheduleSummary } from "./vesting-panel"
import { VestingRolesCard, VestingTreasuryCard } from "./vesting-admin"
import { DisperseCard } from "./disperse-panel"
import { BrandingDialog } from "./branding-dialog"

export function DistributionDetail() {
  const { id } = useParams<{ id: string }>()
  const { address } = useAccount()

  const q = useQuery({
    queryKey: ["distribution", id],
    queryFn: () => getDistribution(id!),
    enabled: !!id,
  })

  if (q.isLoading) return <Loading label="Loading distribution…" />
  if (q.error) return <p className="text-sm text-destructive">{q.error.message}</p>
  if (!q.data) return null

  const d = q.data
  const isOwner = !!address && address.toLowerCase() === d.creator
  const lc = lifecycle(d)

  const heading = (
    <>
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={d.type} />
          <Kicker>/{d.slug}</Kicker>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[clamp(2rem,4.5vw,2.85rem)] leading-tight text-foreground">{d.name}</h1>
          <StatusBadge status={d.status} />
        </div>
      </header>

      <div className="rounded-md border border-border bg-card px-5 py-4">
        <Stepper {...lc} />
        {lc.nextLabel && (
          <p className="mt-3 text-sm text-muted-foreground">
            Next · <span className="text-foreground">{lc.nextLabel}</span>
          </p>
        )}
      </div>
    </>
  )

  // Non-owners get a read-only, single-column view — no management surface.
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {heading}
        <OverviewCard d={d} />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Connect as the creator ({shortAddr(d.creator)}) to manage this distribution.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Owner: Overview (with header actions + inline pause) on top, recipients/main op full-width below.
  return (
    <div className="space-y-6">
      {heading}
      <NextActionCard d={d} nextLabel={lc.nextLabel} />
      <OverviewCard d={d} isOwner />
      <section id="primary-operation" className="scroll-mt-24">
        <MainPanel d={d} />
      </section>
    </div>
  )
}

function NextActionCard({ d, nextLabel }: { d: Distribution; nextLabel: string | null }) {
  const action = nextAction(d, nextLabel)
  const Icon = action.icon

  return (
    <Card className="border-foreground/20 bg-[color-mix(in_oklch,var(--card)_82%,var(--seal)_18%)]">
      <CardContent className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.42fr)] lg:items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-[4px] bg-seal text-seal-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <Kicker className="tracking-[0.12em]">Next action</Kicker>
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground">{action.title}</h2>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{action.body}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
          <div className="space-y-2">
            {action.checks.map((check) => (
              <div key={check.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{check.label}</span>
                <span className="inline-flex items-center gap-1.5 text-foreground">
                  <span className={check.done ? "size-1.5 rounded-full bg-seal" : "size-1.5 rounded-full bg-muted-foreground"} aria-hidden />
                  {check.value}
                </span>
              </div>
            ))}
          </div>

          {action.kind === "share" ? (
            <ShareClaim slug={d.slug} />
          ) : action.href ? (
            <Button asChild className="w-full">
              <a href={action.href}>
                {action.ctaIcon ? <action.ctaIcon /> : null}
                {action.cta}
              </a>
            </Button>
          ) : d.deployTxHash ? (
            <Button asChild variant="outline" className="w-full">
              <a href={`${EXPLORER}/tx/${d.deployTxHash}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                View transaction
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function nextAction(d: Distribution, nextLabel: string | null): {
  kind: "work" | "share" | "done"
  title: string
  body: string
  cta: string
  href?: string
  icon: LucideIcon
  ctaIcon?: LucideIcon
  checks: { label: string; value: string; done: boolean }[]
} {
  if (d.status === "revoked") {
    return {
      kind: "done",
      title: "Distribution revoked",
      body: "This distribution is no longer active. Keep the overview for audit context and use admin surfaces only for recovery or disclosure work.",
      cta: "View transaction",
      icon: Check,
      checks: [
        { label: "Configured", value: "Done", done: true },
        { label: "Active", value: "Revoked", done: false },
      ],
    }
  }

  if (d.type === "disperse") {
    if (d.status === "completed") {
      return {
        kind: "done",
        title: "Batch sent",
        body: "Recipients have received tokens into their confidential balances. The remaining task is audit or residual recovery if wallet mode was used.",
        cta: "View transaction",
        icon: Check,
        checks: [
          { label: "Configured", value: "Done", done: true },
          { label: "Dispersed", value: "Done", done: true },
        ],
      }
    }
    return {
      kind: "work",
      title: "Paste recipients and send the batch",
      body: "Disperse has no separate deploy or claim step. Add address + amount rows, pass pre-flight, then send in one encrypted batch.",
      cta: "Go to disperse form",
      href: "#primary-operation",
      icon: Send,
      ctaIcon: ArrowDown,
      checks: [
        { label: "Configured", value: "Done", done: true },
        { label: "Batch sent", value: "Pending", done: false },
      ],
    }
  }

  const claimType = d.type === "airdrop" ? "claim pool" : "vesting manager"
  const deployLabel = d.type === "airdrop" ? "Deploy & fund" : "Deploy manager"
  const recipientLabel = d.type === "airdrop" ? "claims issued" : "vestings created"

  if (!d.contractAddress) {
    return {
      kind: "work",
      title: nextLabel ?? deployLabel,
      body:
        d.type === "airdrop"
          ? "Fund and deploy the airdrop pool first. Recipients cannot be issued until the pool exists on-chain."
          : "Deploy the vesting manager first. Recipient grants are added after the manager address is written back.",
      cta: deployLabel,
      href: "#primary-operation",
      icon: Rocket,
      ctaIcon: ArrowDown,
      checks: [
        { label: "Distribution configured", value: "Done", done: true },
        { label: `${claimType} deployed`, value: "Pending", done: false },
      ],
    }
  }

  if (d.status !== "live") {
    return {
      kind: "work",
      title: "Add recipients, then publish",
      body: `The ${claimType} is deployed. Add recipients now; once at least one recipient is ready, publish so the claim page becomes useful.`,
      cta: "Go to recipients",
      href: "#primary-operation",
      icon: UserPlus,
      ctaIcon: ArrowDown,
      checks: [
        { label: `${claimType} deployed`, value: "Done", done: true },
        { label: recipientLabel, value: "Needed", done: false },
        { label: "Published", value: "Pending", done: false },
      ],
    }
  }

  return {
    kind: "share",
    title: "Share the claim page",
    body: "This distribution is live. Copy the claim link, hand it to recipients, and keep admin controls for pause, top-up, disclosure, or recovery work.",
    cta: "Share claim page",
    icon: Megaphone,
    checks: [
      { label: `${claimType} deployed`, value: "Done", done: true },
      { label: "Recipients ready", value: "Done", done: true },
      { label: "Published", value: "Live", done: true },
    ],
  }
}

// The current main operation, driven by type + lifecycle. Always full-width.
function MainPanel({ d }: { d: Distribution }) {
  if (d.type === "airdrop") return !d.contractAddress ? <DeployCard d={d} /> : <IssueCard d={d} />
  if (d.type === "vesting") return !d.contractAddress ? <VestingDeployCard d={d} /> : <VestingManageCard d={d} />
  if (d.type === "disperse") return <DisperseCard d={d} />
  return (
    <Card>
      <CardContent className="py-8 text-center text-sm text-muted-foreground">
        Deployment for <span className="capitalize">{d.type}</span> distributions lands in a later milestone.
      </CardContent>
    </Card>
  )
}

// Overview card header actions — low-frequency management opened from a drawer.
function OverviewActions({ d }: { d: Distribution }) {
  if (!d.contractAddress) return null
  if (d.type === "vesting") {
    return (
      <SheetButton label="Advanced" title="Advanced" icon={SlidersHorizontal}>
        <Tabs defaultValue="roles" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="treasury">Treasury</TabsTrigger>
          </TabsList>
          <TabsContent value="roles">
            <VestingRolesCard d={d} />
          </TabsContent>
          <TabsContent value="treasury">
            <VestingTreasuryCard d={d} />
          </TabsContent>
        </Tabs>
      </SheetButton>
    )
  }
  if (d.type === "airdrop") {
    const decimals = numberConfig(d, "decimals", 6)
    return (
      <div className="flex flex-wrap gap-2">
        <SheetButton label="Top up" title="Top up pool" icon={Coins}>
          <TopUpPoolCard token={d.token as Address} pool={d.contractAddress as Address} decimals={decimals} />
        </SheetButton>
        <SheetButton label="Admin" title="Admin controls" icon={Settings2}>
          <AdminCard d={d} />
        </SheetButton>
      </div>
    )
  }
  return null
}

function SheetButton({ label, title, icon: Icon, children }: { label: string; title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          {Icon && <Icon />}
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="p-6 pt-12">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

function OverviewCard({ d, isOwner }: { d: Distribution; isOwner?: boolean }) {
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const showClaim = isOwner && (d.type === "airdrop" || d.type === "vesting")
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Overview</CardTitle>
          {isOwner && <OverviewActions d={d} />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <SummaryRow label="Confidential token" value={<AddressValue value={d.token} href={`${EXPLORER}/token/${d.token}`} />} />
          <SummaryRow
            label="Pool / contract"
            value={
              d.contractAddress ? (
                <AddressValue value={d.contractAddress} href={`${EXPLORER}/address/${d.contractAddress}`} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          {d.deployTxHash && (
            <SummaryRow label="Deploy tx" value={<AddressValue value={d.deployTxHash} href={`${EXPLORER}/tx/${d.deployTxHash}`} />} />
          )}
          <SummaryRow label="Creator" value={<AddressValue value={d.creator} href={`${EXPLORER}/address/${d.creator}`} />} />
          {d.type === "airdrop" && <SummaryRow label="Claim closes" value={endTs ? fmtTime(endTs) : "At deploy"} />}
        </div>
        {d.type === "vesting" && <VestingScheduleSummary d={d} />}
        {isOwner && d.type === "vesting" && d.contractAddress && <VestingPauseRow d={d} />}
        {isOwner && d.type === "airdrop" && d.contractAddress && <AirdropPauseRow d={d} />}
        {showClaim && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <Kicker className="tracking-[0.12em]">Claim page</Kicker>
              <BrandingDialog d={d} />
            </div>
            {d.status === "live" && <ShareClaim slug={d.slug} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Kicker className="tracking-[0.12em]">{label}</Kicker>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs break-all">{children}</span>
}

// Shortened hash/address with copy + open-in-explorer icons (borderless).
function AddressValue({ value, href }: { value: string; href: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked */
    }
  }
  return (
    <span className="flex items-center gap-0.5">
      <Mono>{shortAddr(value)}</Mono>
      <Button size="icon-xs" variant="ghost" onClick={copy} title="Copy" aria-label="Copy">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </Button>
      <Button size="icon-xs" variant="ghost" asChild title="Open in explorer" aria-label="Open in explorer">
        <a href={href} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3" />
        </a>
      </Button>
    </span>
  )
}
