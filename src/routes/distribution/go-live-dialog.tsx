import { useState, type MouseEvent } from "react"
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
  triggerLabel = "Go live",
  triggerVariant = "default",
}: {
  checks: GoLiveCheck[]
  onConfirm: () => void | Promise<void>
  triggerLabel?: string
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive"
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const blockers = checks.filter((c) => c.blocking && !c.ok)

  const onPublish = async (e: MouseEvent) => {
    // Hold the dialog open through the async publish so the spinner is visible
    // (the default AlertDialogAction would close it immediately).
    e.preventDefault()
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // onConfirm surfaces its own error toast; keep the dialog open to retry.
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={triggerVariant}>
          <Radio />
          {triggerLabel}
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
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onPublish} disabled={blockers.length > 0 || busy}>
            {busy ? "Publishing…" : "Publish"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
