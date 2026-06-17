import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Letterspaced small-caps overline — the editorial/legal-document label. */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Highlighter mark — a Zama-gold marker swipe behind solid ink text.
 *  `animate` draws the swipe in like a pen stroke (use `delay` to time it). */
export function Highlight({
  children,
  className,
  animate = false,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  animate?: boolean
  delay?: number
}) {
  return (
    <span
      className={cn("mark-seal text-foreground", animate && "mark-draw", className)}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </span>
  )
}

/** Hairline rule — the primary divider; we compose with rules, not boxes. */
export function Rule({ className }: { className?: string }) {
  return <hr className={cn("h-px border-0 bg-border", className)} />
}

/** Monospaced folio mark, e.g. № 01 — for section/instrument numbering. */
export function Folio({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs tracking-tight text-muted-foreground tabular-nums", className)}>
      {children}
    </span>
  )
}

/** Statement row — small-caps label left, value right, hairline-divided in a <dl>. */
export function Field({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-3", className)}>
      <dt className="shrink-0">
        <Kicker className="tracking-[0.12em]">{label}</Kicker>
      </dt>
      <dd className="text-right text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** A quiet ruled panel for asides — countdowns, closures, gentle errors. */
export function Notice({
  tone = "default",
  children,
  className,
}: {
  tone?: "default" | "seal" | "muted" | "void"
  children: ReactNode
  className?: string
}) {
  const tones = {
    default: "border-border bg-muted/30 text-foreground",
    seal: "border-seal/40 bg-seal-soft text-foreground",
    muted: "border-border bg-muted/40 text-muted-foreground",
    void: "border-destructive/30 bg-destructive/5 text-foreground",
  } as const
  return <div className={cn("rounded-md border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>
}

type SealTone = "live" | "done" | "progress" | "neutral" | "void"

const DOT: Record<SealTone, string> = {
  live: "bg-seal",
  done: "bg-foreground",
  progress: "bg-seal animate-pulse",
  neutral: "bg-muted-foreground",
  void: "bg-destructive",
}

/** Engraved status stamp — a ruled document mark, not a candy pill. */
export function Seal({
  tone = "neutral",
  children,
  className,
}: {
  tone?: SealTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border border-border bg-card px-2 py-[0.1875rem]",
        "font-sans text-[0.625rem] font-semibold uppercase leading-none tracking-[0.14em] text-foreground",
        className,
      )}
    >
      <i className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />
      {children}
    </span>
  )
}
