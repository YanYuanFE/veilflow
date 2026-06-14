import { isAddress, parseUnits, getAddress, type Address } from "viem"
import { shortAddr } from "@/lib/format"

export type Entry = { recipient: Address; amount: bigint }

// Parse a "address, amount" textarea into validated, de-duplicated entries.
export function parseEntries(text: string, decimals: number): { entries: Entry[]; errors: string[] } {
  const entries: Entry[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const [addr, amt] = line.split(/[,\s]+/)
      if (!addr || !isAddress(addr)) {
        errors.push(`Line ${i + 1}: invalid address`)
        return
      }
      if (!amt || !(Number(amt) > 0)) {
        errors.push(`Line ${i + 1}: invalid amount`)
        return
      }
      const key = addr.toLowerCase()
      if (seen.has(key)) {
        errors.push(`Line ${i + 1}: duplicate ${shortAddr(addr)}`)
        return
      }
      seen.add(key)
      try {
        const amount = parseUnits(amt, decimals)
        // Sub-unit amounts round to 0 at this token's precision — reject rather
        // than silently create a zero-amount grant.
        if (amount <= 0n) {
          errors.push(`Line ${i + 1}: amount too small for ${decimals} decimals`)
          return
        }
        entries.push({ recipient: getAddress(addr), amount })
      } catch {
        errors.push(`Line ${i + 1}: bad amount`)
      }
    })
  return { entries, errors }
}

// Read a recipients CSV File → normalized "addr, amount" lines, header row dropped.
export function readRecipientCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      // Drop a header row if the first cell isn't an address.
      if (lines[0] && !isAddress(lines[0].split(/[,\s]+/)[0])) lines.shift()
      resolve(lines.join("\n"))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** Download a starter CSV so issuers know the expected shape. */
export function downloadRecipientTemplate() {
  const csv =
    "address,amount\n0x0000000000000000000000000000000000000001,100\n0x0000000000000000000000000000000000000002,250.5\n"
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  const a = document.createElement("a")
  a.href = url
  a.download = "recipients-template.csv"
  a.click()
  URL.revokeObjectURL(url)
}
