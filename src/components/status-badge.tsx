import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DistributionStatus } from "@/lib/api"

type Variant = "secondary" | "outline" | "destructive"

// variant = chip tone, dot = at-a-glance status colour (contrasts its chip).
const STATUS: Record<DistributionStatus, { variant: Variant; dot: string }> = {
  draft: { variant: "outline", dot: "bg-muted-foreground" },
  deploying: { variant: "secondary", dot: "bg-seal animate-pulse" },
  deployed: { variant: "secondary", dot: "bg-muted-foreground" },
  funded: { variant: "secondary", dot: "bg-muted-foreground" },
  live: { variant: "secondary", dot: "bg-seal" },
  completed: { variant: "outline", dot: "bg-foreground" },
  revoked: { variant: "destructive", dot: "bg-background" },
}

export function StatusBadge({ status }: { status: DistributionStatus }) {
  const { variant, dot } = STATUS[status]
  return (
    <Badge variant={variant} className="gap-1.5 uppercase tracking-[0.1em]">
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {status}
    </Badge>
  )
}
