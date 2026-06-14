import { type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Redaction — the core confidential-value primitive.
 *
 * An encrypted figure renders as a classified-document censor bar (solid ink).
 * When `revealed` flips true, the ink lifts via a clip-path wipe and the figure
 * underneath is shown — the FHE `userDecrypt` action mapped to un-redacting a
 * confidential document. Only the holder of the key ever flips it.
 */
export function Redaction({
  revealed = false,
  loading = false,
  children,
  chars = 6,
  align = "start",
  className,
}: {
  /** true once the viewer has decrypted this value */
  revealed?: boolean
  /** decryption in flight — the bar breathes */
  loading?: boolean
  /** the figure to expose once revealed */
  children?: ReactNode
  /** width of the sealed bar when the value is unknown, in ch */
  chars?: number
  align?: "start" | "end"
  className?: string
}) {
  const hasValue = children !== undefined && children !== null && children !== ""
  return (
    <span
      className={cn(
        "relative inline-flex items-baseline align-baseline tabular-nums",
        align === "end" && "justify-end text-right",
        className,
      )}
      style={{ minWidth: hasValue && revealed ? undefined : `${chars}ch` }}
    >
      <span
        className={cn(
          "transition-opacity duration-500 [transition-timing-function:var(--ease-veil)]",
          revealed && hasValue ? "opacity-100" : "opacity-0",
        )}
        aria-hidden={!revealed || !hasValue}
      >
        {hasValue ? children : " "}
      </span>
      <span
        aria-label={revealed ? undefined : loading ? "Decrypting" : "Sealed — encrypted on-chain"}
        role={revealed ? undefined : "img"}
        className={cn(
          "veil-bar pointer-events-none absolute inset-x-0 top-1/2 h-[1.05em] -translate-y-1/2 rounded-[2px]",
          "transition-[clip-path] duration-[700ms] [transition-timing-function:var(--ease-veil)]",
          loading && !revealed && "animate-pulse",
        )}
        style={{ clipPath: revealed ? "inset(0 0 0 100%)" : "inset(0 0 0 0)" }}
      />
    </span>
  )
}
