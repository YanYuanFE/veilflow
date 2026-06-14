import { type ReactNode } from "react"
import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { Kicker } from "@/components/editorial"
import { Stepper } from "@/components/stepper"
import { ShareClaim } from "@/components/share-claim"
import { shortAddr, fmtTime } from "@/lib/format"
import { lifecycle } from "@/lib/lifecycle"
import { getDistribution, type Distribution } from "@/lib/api"
import { EXPLORER, numberConfig } from "./shared"
import { DeployCard, IssueCard } from "./airdrop-panel"
import { VestingDeployCard, VestingManageCard } from "./vesting-panel"
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

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (q.error) return <p className="text-sm text-destructive">{q.error.message}</p>
  if (!q.data) return null

  const d = q.data
  const isOwner = !!address && address.toLowerCase() === d.creator
  const lc = lifecycle(d)

  return (
    <div className="space-y-6">
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

      <Overview d={d} isOwner={isOwner} />

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

function Overview({ d, isOwner }: { d: Distribution; isOwner: boolean }) {
  const startTs = typeof d.config.startTimestamp === "number" ? d.config.startTimestamp : null
  const endTs = typeof d.config.endTimestamp === "number" ? d.config.endTimestamp : null
  const admin = typeof d.config.admin === "string" ? d.config.admin : d.creator
  const canExtend = d.config.canExtendClaimWindow === true
  const cliffDays = Math.round(numberConfig(d, "cliffSeconds", 0) / 86_400)
  const intervalDays = Math.round(numberConfig(d, "releaseIntervalSecs", 86_400) / 86_400)
  const initialPct = numberConfig(d, "initialUnlockBps", 0) / 100
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
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
          {d.type === "vesting" && (
            <>
              <Row label="Vesting starts" value={fmtTime(numberConfig(d, "startTimestamp", 0))} />
              <Row label="Vesting ends" value={fmtTime(numberConfig(d, "endTimestamp", 0))} />
              <Row label="Cliff" value={`${cliffDays} day${cliffDays === 1 ? "" : "s"}`} />
              <Row label="Release interval" value={`${intervalDays} day${intervalDays === 1 ? "" : "s"}`} />
              <Row label="Initial unlock" value={`${initialPct}%`} />
              <Row label="Revocable" value={d.config.isRevocable === true ? "Yes" : "No"} />
            </>
          )}
        </div>
        {(d.type === "airdrop" || d.type === "vesting") && (isOwner || d.status === "live") && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3">
              <Kicker>Claim page</Kicker>
              {isOwner && <BrandingDialog d={d} />}
            </div>
            {d.status === "live" && <ShareClaim slug={d.slug} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
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
