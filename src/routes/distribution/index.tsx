import { type ReactNode, useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/status-badge"
import { Kicker } from "@/components/editorial"
import { Loading } from "@/components/spinner"
import { Stepper } from "@/components/stepper"
import { ShareClaim } from "@/components/share-claim"
import { shortAddr, fmtTime } from "@/lib/format"
import { lifecycle } from "@/lib/lifecycle"
import { getDistribution, type Distribution } from "@/lib/api"
import { EXPLORER, numberConfig } from "./shared"
import { DeployCard, IssueCard, TopUpPoolCard, AdminCard } from "./airdrop-panel"
import { VestingDeployCard, VestingManageCard, VestingPauseRow, VestingDisclosureCard } from "./vesting-panel"
import { VestingRolesCard, VestingTreasuryCard, VestingAdminViewsCard } from "./vesting-admin"
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
        <Kicker>
          {d.type} · /{d.slug}
        </Kicker>
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
      <OverviewCard d={d} isOwner />
      <MainPanel d={d} />
    </div>
  )
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
      <SheetButton label="Advanced" title="Advanced">
        <Tabs defaultValue="roles" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="treasury">Treasury</TabsTrigger>
            <TabsTrigger value="views">Views</TabsTrigger>
            <TabsTrigger value="disclose">Disclose</TabsTrigger>
          </TabsList>
          <TabsContent value="roles">
            <VestingRolesCard d={d} />
          </TabsContent>
          <TabsContent value="treasury">
            <VestingTreasuryCard d={d} />
          </TabsContent>
          <TabsContent value="views">
            <VestingAdminViewsCard d={d} />
          </TabsContent>
          <TabsContent value="disclose">
            <VestingDisclosureCard d={d} />
          </TabsContent>
        </Tabs>
      </SheetButton>
    )
  }
  if (d.type === "airdrop") {
    const decimals = numberConfig(d, "decimals", 6)
    return (
      <div className="flex flex-wrap gap-2">
        <SheetButton label="Top up" title="Top up pool">
          <TopUpPoolCard token={d.token as Address} pool={d.contractAddress as Address} decimals={decimals} />
        </SheetButton>
        <SheetButton label="Admin" title="Admin controls">
          <AdminCard d={d} />
        </SheetButton>
      </div>
    )
  }
  return null
}

function SheetButton({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
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
  const startTs = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
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
          {d.type === "vesting" && <SummaryRow label="Schedule" value={`${fmtTime(startTs ?? 0)} → ${fmtTime(endTs ?? 0)}`} />}
        </div>
        {isOwner && d.type === "vesting" && d.contractAddress && <VestingPauseRow d={d} />}
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
