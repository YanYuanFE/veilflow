import { useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

/** The public claim link, ready to hand out — copy + open. */
export function ShareClaim({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== "undefined" ? `${window.location.origin}/claim/${slug}` : `/claim/${slug}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <div className="flex items-center gap-1">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{url}</code>
      <Button size="icon-sm" variant="ghost" onClick={copy} title="Copy link" aria-label="Copy link">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <Button size="icon-sm" variant="ghost" asChild title="Open claim page" aria-label="Open claim page">
        <a href={`/claim/${slug}`} target="_blank" rel="noreferrer">
          <ExternalLink className="size-3.5" />
        </a>
      </Button>
    </div>
  )
}
