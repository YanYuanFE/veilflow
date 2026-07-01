import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DistributionStatus, DistributionType } from "@/lib/api"

type Variant = "secondary" | "outline" | "destructive"

// variant = chip tone, dot = at-a-glance status colour (contrasts its chip).
// className tints the chip for terminal states: green = done, so "completed"
// doesn't read the same as the neutral "draft".
const STATUS: Record<DistributionStatus, { variant: Variant; dot: string; className?: string }> = {
  draft: { variant: "outline", dot: "bg-muted-foreground" },
  deploying: { variant: "secondary", dot: "bg-primary animate-pulse" },
  deployed: { variant: "secondary", dot: "bg-muted-foreground" },
  funded: { variant: "secondary", dot: "bg-muted-foreground" },
  live: { variant: "secondary", dot: "bg-primary" },
  completed: {
    variant: "outline",
    dot: "bg-emerald-500",
    className: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
  },
  revoked: { variant: "destructive", dot: "bg-background" },
}

export function StatusBadge({ status }: { status: DistributionStatus }) {
  const { variant, dot, className } = STATUS[status]
  return (
    <Badge variant={variant} className={cn("gap-1.5 uppercase tracking-[0.1em]", className)}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {status}
    </Badge>
  )
}

/** Distribution type as a compact category tag — filled, no dot (so it reads
 *  distinct from StatusBadge's dotted status chip). */
export function TypeBadge({ type }: { type: DistributionType }) {
  return (
    <Badge variant="secondary" className="rounded-[3px] px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.1em]">
      {type}
    </Badge>
  )
}
