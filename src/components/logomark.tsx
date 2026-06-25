/**
 * VeilFlow mark — a confidential document: one open line, one line sealed in gold.
 * Themed: ink follows `currentColor`, the seal follows `--primary`.
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="27" height="27" rx="7" fill="currentColor" />
      <rect x="9" y="11" width="9" height="2.4" rx="1.2" fill="var(--background)" opacity="0.5" />
      <rect x="9" y="18.6" width="14" height="3.2" rx="1.6" fill="var(--primary)" />
    </svg>
  )
}
