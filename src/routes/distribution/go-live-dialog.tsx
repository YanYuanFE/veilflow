import { Check, X, Radio } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

export type GoLiveCheck = { label: string; ok: boolean; blocking?: boolean; detail?: string }

/** Pre-flight checklist shown before publishing. Blocking items that fail
 *  disable the Publish action — so a distribution can't go live under-prepared. */
export function GoLiveDialog({
  checks,
  onConfirm,
  busy,
}: {
  checks: GoLiveCheck[]
  onConfirm: () => void
  busy?: boolean
}) {
  const blockers = checks.filter((c) => c.blocking && !c.ok)
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <Radio />
          Go live
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish — open claims to recipients?</AlertDialogTitle>
          <AlertDialogDescription>
            Recipients will be able to claim at the public link. Run through the checklist first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-2 text-sm">
          {checks.map((c) => {
            const failed = !!c.blocking && !c.ok
            return (
              <li key={c.label} className="flex items-start gap-2.5">
                {c.ok ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-seal" aria-hidden />
                ) : (
                  <X className={cn("mt-0.5 size-4 shrink-0", failed ? "text-destructive" : "text-muted-foreground")} aria-hidden />
                )}
                <span className={cn(c.ok ? "text-foreground" : failed ? "text-destructive" : "text-muted-foreground")}>
                  {c.label}
                  {c.detail && <span className="text-muted-foreground"> · {c.detail}</span>}
                </span>
              </li>
            )
          })}
        </ul>
        {blockers.length > 0 && (
          <p className="text-sm text-destructive">Resolve the blocking items above before publishing.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={blockers.length > 0 || busy}>
            {busy ? "Publishing…" : "Publish"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
