// Per-distribution branding for the public claim page. Stored in distributions.theme (jsonb).
export interface DistributionTheme {
  mode?: "light" | "dark"
  accent?: string // any CSS color (a hex from the picker) — drives the brand accent (--primary)
  logoUrl?: string
  title?: string
  description?: string
}

/** Safely read the typed theme out of the raw jsonb. */
export function parseTheme(raw: Record<string, unknown> | null | undefined): DistributionTheme {
  if (!raw || typeof raw !== "object") return {}
  const t: DistributionTheme = {}
  if (raw.mode === "dark" || raw.mode === "light") t.mode = raw.mode
  if (typeof raw.accent === "string") t.accent = raw.accent
  if (typeof raw.logoUrl === "string") t.logoUrl = raw.logoUrl
  if (typeof raw.title === "string") t.title = raw.title
  if (typeof raw.description === "string") t.description = raw.description
  return t
}

/** A readable ink/paper color to sit on top of a hex accent (WCAG relative luminance). */
export function readableInk(hex: string): string {
  const h = hex.replace("#", "")
  if (h.length < 6) return "oklch(0.22 0.02 80)"
  const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const r = toLin(parseInt(h.slice(0, 2), 16) / 255)
  const g = toLin(parseInt(h.slice(2, 4), 16) / 255)
  const b = toLin(parseInt(h.slice(4, 6), 16) / 255)
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.45 ? "oklch(0.22 0.02 80)" : "#ffffff" // dark ink on light accent, white on dark accent
}
