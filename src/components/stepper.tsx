import { Fragment } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Lifecycle } from "@/lib/lifecycle"

/** Horizontal lifecycle stepper — done (ink ✓) · active (gold) · upcoming (hollow). */
export function Stepper({ steps, current, done }: Lifecycle) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {steps.map((s, i) => {
        const state = i < current || (i === current && done) ? "done" : i === current ? "active" : "upcoming"
        return (
          <Fragment key={s.key}>
            {i > 0 && (
              <span className={cn("hidden h-px w-6 sm:block lg:w-10", i <= current ? "bg-seal" : "bg-border")} aria-hidden />
            )}
            <li className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[0.6875rem] font-semibold tabular-nums",
                  (state === "done" || state === "active") && "bg-seal text-seal-foreground",
                  state === "upcoming" && "border border-border text-muted-foreground",
                )}
                aria-current={state === "active" ? "step" : undefined}
              >
                {state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[0.6875rem] font-semibold tracking-[0.12em] uppercase",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
