export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export function shortAddr(addr?: string | null): string {
  if (!addr) return "—"
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function fmtTime(ts?: number | null): string {
  if (ts == null) return "—"
  return new Date(ts * 1000).toLocaleString()
}
