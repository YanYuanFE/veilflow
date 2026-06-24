import { useId, useMemo, useRef, useState, type ReactNode } from "react"
import { formatUnits, type Address } from "viem"
import { ChevronLeft, ChevronRight, Upload, UserPlus, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Kicker } from "@/components/editorial"
import { shortAddr } from "@/lib/format"
import { cn } from "@/lib/utils"
import { downloadRecipientTemplate, readRecipientCsv, type Entry } from "@/lib/recipients"

type PreviewFilter = "ready" | "errors" | "checking" | "unverified" | "skipped" | "all"
type EntryStatus = "ready" | "skipped" | "checking" | "unverified"
type EntryPreviewRow = { kind: "entry"; line: number; entry: Entry; status: EntryStatus }
type ErrorPreviewRow = { kind: "error"; line: number; message: string; raw: string }
type PreviewRow = EntryPreviewRow | ErrorPreviewRow

const PAGE_SIZES = [25, 50, 100]

export function RecipientImportPanel({
  value,
  onChange,
  entries,
  errors,
  decimals,
  walletAddress,
  issued,
  issuedLabel,
  pending,
  checkingCount,
  checkingLabel = "Checking",
  unverified,
  unverifiedCount,
  unverifiedLabel = "Unverified",
  readyCount,
  readyLabel = "Ready",
  skippedCount = 0,
  skippedLabel = "Skipped",
  batchTotal,
  batchLabel = "Total",
  batchDetail,
  previewLabel = "Parsed recipients",
}: {
  value: string
  onChange: (value: string) => void
  entries: Entry[]
  errors: string[]
  decimals: number
  walletAddress?: Address
  issued?: Set<string>
  issuedLabel?: string
  pending?: Set<string>
  checkingCount?: number
  checkingLabel?: string
  unverified?: Set<string>
  unverifiedCount?: number
  unverifiedLabel?: string
  readyCount: number
  readyLabel?: string
  skippedCount?: number
  skippedLabel?: string
  batchTotal: bigint
  batchLabel?: string
  batchDetail?: ReactNode
  previewLabel?: string
}) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const hasRows = entries.length > 0 || errors.length > 0
  const [filter, setFilter] = useState<PreviewFilter>("ready")
  const [pageSize, setPageSize] = useState(25)
  const [pageIndex, setPageIndex] = useState(0)

  const { readyRows, checkingRows, unverifiedRows, skippedRows, errorRows, allRows } = useMemo(() => {
    const normalizedIssued = issued ?? new Set<string>()
    const normalizedPending = pending ?? new Set<string>()
    const normalizedUnverified = unverified ?? new Set<string>()
    const parsedEntries: EntryPreviewRow[] = entries.map((entry, index) => {
      const key = entry.recipient.toLowerCase()
      const status = normalizedIssued.has(key)
        ? "skipped"
        : normalizedUnverified.has(key)
          ? "unverified"
          : normalizedPending.has(key)
            ? "checking"
            : "ready"
      return { kind: "entry", line: entry.line ?? index + 1, entry, status }
    })
    const parsedErrors = errors.map(parseErrorRow)
    const all = [...parsedEntries, ...parsedErrors].sort((a, b) => a.line - b.line || (a.kind === "error" ? 1 : -1))
    return {
      readyRows: parsedEntries.filter((row) => row.status === "ready"),
      checkingRows: parsedEntries.filter((row) => row.status === "checking"),
      unverifiedRows: parsedEntries.filter((row) => row.status === "unverified"),
      skippedRows: parsedEntries.filter((row) => row.status === "skipped"),
      errorRows: parsedErrors,
      allRows: all,
    }
  }, [entries, errors, issued, pending, unverified])

  const filteredRows =
    filter === "ready"
      ? readyRows
      : filter === "errors"
        ? errorRows
        : filter === "checking"
          ? checkingRows
          : filter === "unverified"
            ? unverifiedRows
            : filter === "skipped"
              ? skippedRows
              : allRows
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePageIndex = Math.min(pageIndex, pageCount - 1)
  const visibleRows = filteredRows.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize)
  const rangeStart = filteredRows.length === 0 ? 0 : safePageIndex * pageSize + 1
  const rangeEnd = Math.min(filteredRows.length, (safePageIndex + 1) * pageSize)

  const changeFilter = (next: PreviewFilter) => {
    setFilter(next)
    setPageIndex(0)
  }

  const appendWallet = () => {
    if (!walletAddress) return
    onChange(`${value}${value && !value.endsWith("\n") ? "\n" : ""}${walletAddress}, `)
  }

  const loadCsv = (file: File) => {
    void readRecipientCsv(file).then((text) => onChange(value ? `${value}\n${text}` : text))
  }

  return (
    <div className="space-y-4 border-y border-border py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={inputId}>Recipients</Label>
            <Kicker className="tracking-[0.12em]">address, amount</Kicker>
          </div>
          <textarea
            id={inputId}
            className="min-h-36 w-full rounded-[4px] border border-input bg-background/60 p-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            placeholder={"0xRecipient..., 100\n0xAnother..., 250"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" type="button" disabled={!walletAddress} onClick={appendWallet}>
              <UserPlus />
              Add my address
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) loadCsv(f)
                e.target.value = ""
              }}
            />
            <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()}>
              <Upload />
              Upload CSV
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={downloadRecipientTemplate}>
              <FileDown />
              Template
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pl-4 lg:pt-0">
          <Kicker className="tracking-[0.12em]">Parse check</Kicker>
          <div className="space-y-2">
            <ImportMetric label={readyLabel} value={readyCount.toString()} tone={readyCount > 0 ? "ready" : "muted"} />
            {(checkingCount ?? checkingRows.length) > 0 && (
              <ImportMetric label={checkingLabel} value={(checkingCount ?? checkingRows.length).toString()} />
            )}
            {(unverifiedCount ?? unverifiedRows.length) > 0 && (
              <ImportMetric
                label={unverifiedLabel}
                value={(unverifiedCount ?? unverifiedRows.length).toString()}
                tone="error"
              />
            )}
            <ImportMetric label="Errors" value={errors.length.toString()} tone={errors.length > 0 ? "error" : "ready"} />
            <ImportMetric label={skippedLabel} value={skippedCount.toString()} tone={skippedCount > 0 ? "muted" : "ready"} />
            <ImportMetric label={batchLabel} value={batchTotal > 0n ? formatUnits(batchTotal, decimals) : "0"} mono />
          </div>
          {batchDetail && <p className="text-xs leading-relaxed text-muted-foreground">{batchDetail}</p>}
        </div>
      </div>

      {hasRows && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Kicker className="tracking-[0.12em]">{previewLabel}</Kicker>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-[4px] border border-border bg-background p-0.5">
                <PreviewFilterButton active={filter === "ready"} label={readyLabel} count={readyRows.length} onClick={() => changeFilter("ready")} />
                <PreviewFilterButton active={filter === "errors"} label="Errors" count={errorRows.length} onClick={() => changeFilter("errors")} />
                {checkingRows.length > 0 && (
                  <PreviewFilterButton
                    active={filter === "checking"}
                    label={checkingLabel}
                    count={checkingRows.length}
                    onClick={() => changeFilter("checking")}
                  />
                )}
                {unverifiedRows.length > 0 && (
                  <PreviewFilterButton
                    active={filter === "unverified"}
                    label={unverifiedLabel}
                    count={unverifiedRows.length}
                    onClick={() => changeFilter("unverified")}
                  />
                )}
                <PreviewFilterButton active={filter === "skipped"} label={skippedLabel} count={skippedRows.length} onClick={() => changeFilter("skipped")} />
                <PreviewFilterButton active={filter === "all"} label="All" count={allRows.length} onClick={() => changeFilter("all")} />
              </div>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v))
                  setPageIndex(0)
                }}
              >
                <SelectTrigger size="sm" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <PreviewRowsTable
            rows={visibleRows}
            decimals={decimals}
            issuedLabel={issuedLabel}
            skippedLabel={skippedLabel}
            checkingLabel={checkingLabel}
            unverifiedLabel={unverifiedLabel}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {rangeStart}-{rangeEnd} of {filteredRows.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Previous preview page"
                disabled={safePageIndex === 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-14 text-center tabular-nums">
                {safePageIndex + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                aria-label="Next preview page"
                disabled={safePageIndex >= pageCount - 1}
                onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PreviewFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "rounded-[3px] px-2.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
      onClick={onClick}
    >
      {label} <span className="text-muted-foreground">{count}</span>
    </button>
  )
}

function PreviewRowsTable({
  rows,
  decimals,
  issuedLabel = "Issued",
  skippedLabel,
  checkingLabel,
  unverifiedLabel,
}: {
  rows: PreviewRow[]
  decimals: number
  issuedLabel?: string
  skippedLabel: string
  checkingLabel: string
  unverifiedLabel: string
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No rows in this view.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-16 px-3 py-2 text-left">
              <Kicker>Line</Kicker>
            </th>
            <th className="px-3 py-2 text-left">
              <Kicker>Recipient</Kicker>
            </th>
            <th className="px-3 py-2 text-right">
              <Kicker>Amount</Kicker>
            </th>
            <th className="px-3 py-2 text-right">
              <Kicker>Status</Kicker>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) =>
            row.kind === "error" ? (
              <tr key={`${row.raw}-${index}`}>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.line}</td>
                <td className="px-3 py-2 text-destructive">{row.message}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">n/a</td>
                <td className="px-3 py-2 text-right text-xs text-destructive">Error</td>
              </tr>
            ) : (
              <tr key={`${row.entry.recipient}-${row.line}-${index}`}>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.line}</td>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{shortAddr(row.entry.recipient)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                  {formatUnits(row.entry.amount, decimals)}
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <span
                    className={cn(
                      row.status === "ready" && "text-foreground",
                      row.status === "unverified" && "text-destructive",
                      (row.status === "skipped" || row.status === "checking") && "text-muted-foreground",
                    )}
                  >
                    {row.status === "skipped"
                      ? issuedLabel ?? skippedLabel
                      : row.status === "checking"
                        ? checkingLabel
                        : row.status === "unverified"
                          ? unverifiedLabel
                          : "Ready"}
                  </span>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function parseErrorRow(error: string, index: number): ErrorPreviewRow {
  const match = /^Line\s+(\d+):\s*(.+)$/.exec(error)
  return {
    kind: "error",
    line: match ? Number(match[1]) : index + 1,
    message: match?.[2] ?? error,
    raw: error,
  }
}

function ImportMetric({
  label,
  value,
  tone = "muted",
  mono,
}: {
  label: string
  value: string
  tone?: "ready" | "muted" | "error"
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <Kicker className="shrink-0 tracking-[0.12em]">{label}</Kicker>
      <div
        className={cn(
          "min-w-0 truncate text-right text-sm font-semibold tabular-nums",
          mono && "font-mono text-xs",
          tone === "ready" && "text-foreground",
          tone === "muted" && "text-muted-foreground",
          tone === "error" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  )
}
