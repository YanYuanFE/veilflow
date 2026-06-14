import { formatUnits, type Address } from "viem"
import { Kicker } from "@/components/editorial"
import { shortAddr } from "@/lib/format"

/** Read-only preview of parsed recipients — exactly what will be submitted, with status. */
export function RecipientPreview({
  entries,
  issued,
  decimals,
  issuedLabel = "Issued",
  max = 50,
}: {
  entries: { recipient: Address; amount: bigint }[]
  issued?: Set<string>
  decimals: number
  issuedLabel?: string
  max?: number
}) {
  if (entries.length === 0) return null
  const shown = entries.slice(0, max)
  return (
    <div className="overflow-hidden rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
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
          {shown.map((e, i) => {
            const dup = issued?.has(e.recipient.toLowerCase())
            return (
              <tr key={`${e.recipient}-${i}`}>
                <td className="px-3 py-2 font-mono text-xs text-foreground">{shortAddr(e.recipient)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">{formatUnits(e.amount, decimals)}</td>
                <td className="px-3 py-2 text-right text-xs">
                  <span className={dup ? "text-muted-foreground" : "text-foreground"}>{dup ? issuedLabel : "New"}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {entries.length > max && (
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          +{entries.length - max} more
        </div>
      )}
    </div>
  )
}
