import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Ghost icon button that copies `value` to the clipboard, flashing a check on success. */
export function CopyButton({ value, title = "Copy" }: { value: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked */
    }
  }
  return (
    <Button size="icon-xs" variant="ghost" onClick={copy} title={title} aria-label={title}>
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </Button>
  )
}
