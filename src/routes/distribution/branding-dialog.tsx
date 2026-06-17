import { useState, type CSSProperties } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Kicker } from "@/components/editorial"
import { cn } from "@/lib/utils"
import { parseTheme, readableInk } from "@/lib/theme"
import { patchDistribution, type Distribution } from "@/lib/api"
import { err } from "./shared"

export function BrandingDialog({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const t0 = parseTheme(d.theme)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"light" | "dark">(t0.mode ?? "light")
  const [accent, setAccent] = useState(t0.accent ?? "#e0b21f")
  const [logoUrl, setLogoUrl] = useState(t0.logoUrl ?? "")
  const [title, setTitle] = useState(t0.title ?? "")
  const [description, setDescription] = useState(t0.description ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await patchDistribution(d.id, {
        theme: {
          mode,
          accent,
          logoUrl: logoUrl.trim() || undefined,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
        },
      })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
      toast.success("Branding saved")
      setOpen(false)
    } catch (e) {
      toast.error(err(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Claim page branding</DialogTitle>
          <DialogDescription>
            How recipients see{" "}
            <a
              className="underline decoration-border underline-offset-2 hover:decoration-foreground"
              href={`/claim/${d.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              /claim/{d.slug} ↗
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="brand-mode">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "light" | "dark")}>
              <SelectTrigger id="brand-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-accent">Accent</Label>
            <div className="flex items-center gap-2">
              <input
                id="brand-accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-8 w-10 shrink-0 cursor-pointer rounded-sm border border-input bg-transparent p-0.5"
              />
              <Input value={accent} onChange={(e) => setAccent(e.target.value)} className="font-mono" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-logo">Logo URL</Label>
          <Input id="brand-logo" placeholder="https://…/logo.svg" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-title">Title</Label>
          <Input id="brand-title" placeholder={d.name} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-description">Description</Label>
          <textarea
            id="brand-description"
            placeholder="Only you can read your own figure…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-20 w-full rounded-sm border border-input bg-transparent p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>

        {/* Live preview of the claim page chrome */}
        <div>
          <Kicker className="tracking-[0.12em]">Preview</Kicker>
          <div
            className={cn("mt-2 overflow-hidden rounded-md border border-border", mode === "dark" && "dark")}
            style={{ "--seal": accent, "--seal-foreground": readableInk(accent) } as CSSProperties}
          >
            <div className="h-[2px] w-full bg-seal" />
            <div className="flex items-center justify-between gap-3 bg-background px-4 py-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-6 max-w-[140px] object-contain" />
              ) : (
                <span className="font-display text-lg text-foreground">{d.name}</span>
              )}
              <span className="rounded-sm bg-seal px-2 py-1 text-[0.6875rem] font-semibold text-seal-foreground">Decrypt</span>
            </div>
            <div className="bg-background px-4 pb-4">
              {(title || description) && (
                <div className="mb-3 space-y-1">
                  {title && <p className="font-display text-base text-foreground">{title}</p>}
                  {description && <p className="font-sans text-sm text-muted-foreground">{description}</p>}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 rounded-sm border border-border bg-card px-3 py-2">
                <span className="text-[0.625rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Your allocation</span>
                <span className="veil-bar inline-block h-[1.05em] w-20 rounded-[2px]" />
              </div>
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save branding"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
