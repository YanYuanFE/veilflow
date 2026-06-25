import { cn } from "@/lib/utils"
import { Kicker } from "@/components/editorial"

// A gold-seal ring spinner — a faint border with one bright seal arc that rotates.
// Matches the editorial palette instead of a generic loader.
const SIZES = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-9 border-[3px]",
}

export function Spinner({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block shrink-0 animate-spin rounded-full border-border border-t-primary", SIZES[size], className)}
    />
  )
}

// Centered page-level loading state: the spinner plus an optional caption.
export function Loading({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 py-16 text-center", className)}>
      <Spinner size="lg" />
      {label && <Kicker>{label}</Kicker>}
    </div>
  )
}
