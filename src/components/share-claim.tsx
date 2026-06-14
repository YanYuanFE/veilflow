import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kicker } from "@/components/editorial"

/** The public claim link, ready to hand out — copy + QR. */
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
    <div className="rounded-sm border border-border bg-muted/20 p-4 text-foreground">
      <Kicker>Share the claim link</Kicker>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-sm border border-border bg-card p-2">
          <QRCodeSVG value={url} size={92} bgColor="transparent" fgColor="currentColor" />
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <code className="block truncate rounded-sm border border-border bg-card px-2.5 py-1.5 font-mono text-xs">{url}</code>
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <a
              href={`/claim/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground underline decoration-border underline-offset-2 hover:decoration-foreground"
            >
              Open
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
