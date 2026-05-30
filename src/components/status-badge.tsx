import { cn } from "@/lib/utils"
import type { DistributionStatus } from "@/lib/api"

const STYLES: Record<DistributionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  deploying: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  deployed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  funded: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  live: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  revoked: "bg-destructive/15 text-destructive",
}

export function StatusBadge({ status }: { status: DistributionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[status],
      )}
    >
      {status}
    </span>
  )
}
