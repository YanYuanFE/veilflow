import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { formatUnits, isAddress, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { Lock } from "lucide-react"
import { useUserDecrypt } from "@zama-fhe/react-sdk"
import { useManagerToken } from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Redaction } from "@/components/ui/redaction"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Kicker } from "@/components/editorial"
import { useTokenMeta } from "@/lib/tokens"
import { listDisclosuresFor } from "@/lib/api"
import { shortAddr } from "@/lib/format"

const ZERO = "0x0000000000000000000000000000000000000000" as Address
const VID_RE = /^0x[0-9a-fA-F]{64}$/

const TYPES = [
  { value: DisclosureType.TotalAllocation, label: "Total allocation" },
  { value: DisclosureType.VestedAmount, label: "Vested amount" },
  { value: DisclosureType.ClaimableAmount, label: "Claimable amount" },
  { value: DisclosureType.SettledAmount, label: "Settled (claimed) amount" },
]

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function Audit() {
  const [sp] = useSearchParams()
  const { address, isConnected } = useAccount()
  const mine = useQuery({
    queryKey: ["disclosures", address],
    queryFn: () => listDisclosuresFor(address!),
    enabled: isConnected && !!address,
  })

  const [manager, setManager] = useState(sp.get("manager") ?? "")
  const [vestingId, setVestingId] = useState(sp.get("vesting") ?? "")
  const [dtype, setDtype] = useState<DisclosureType>(Number(sp.get("type") ?? DisclosureType.TotalAllocation) as DisclosureType)
  const [viewHandle, setViewHandle] = useState<Hex>()

  const validManager = isAddress(manager)
  const validVid = VID_RE.test(vestingId)
  const m = (validManager ? manager : ZERO) as Address

  const tokenQ = useManagerToken({ address: m })
  const meta = useTokenMeta(validManager ? tokenQ.data : undefined)
  const decimals = meta.decimals ?? 6

  // The auditor decrypts the handle granted to them at disclosure time. The get*/getVested*
  // getters are recipient-scoped and revert for anyone who isn't the vesting's recipient, so we
  // match the form (manager + vesting + figure) to a disclosure recorded for THIS wallet and
  // decrypt its stored handle instead of calling a getter.
  const matched = mine.data?.find(
    (r) =>
      r.manager.toLowerCase() === manager.toLowerCase() &&
      r.vestingId.toLowerCase() === vestingId.toLowerCase() &&
      r.disclosureType === dtype &&
      !!r.handle,
  )
  const matchedHandle = matched?.handle as Hex | undefined

  const decrypt = useUserDecrypt(
    { handles: viewHandle && validManager ? [{ handle: viewHandle, contractAddress: m }] : [] },
    { enabled: !!viewHandle && validManager },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined
  const revealedText =
    typeof revealed === "bigint" ? `${formatUnits(revealed, decimals)}${meta.symbol ? ` ${meta.symbol}` : ""}` : undefined
  const revealing = !!viewHandle && revealed === undefined && !decrypt.error
  const typeLabel = TYPES.find((t) => t.value === dtype)?.label ?? ""

  const onReveal = () => {
    // No on-chain call — decrypt the handle the issuer already granted this wallet.
    if (matchedHandle) setViewHandle(matchedHandle)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Kicker>Compliance · Auditor view</Kicker>
        <h1 className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-tight text-foreground">Auditor view</h1>
        <p className="font-sans text-[1.0625rem] leading-relaxed text-muted-foreground">
          Read one encrypted vesting figure you were granted access to. Connect the wallet the issuer disclosed to — no
          one else can lift the veil.
        </p>
      </header>

      {isConnected && mine.data && mine.data.length > 0 && (
        <div className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-5 py-3">
            <Kicker>Disclosed to you</Kicker>
          </div>
          <ul className="divide-y divide-border">
            {mine.data.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => {
                    setManager(row.manager)
                    setVestingId(row.vestingId)
                    setDtype(row.disclosureType as DisclosureType)
                    setViewHandle(undefined)
                  }}
                  className="group flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-foreground">
                      {TYPES.find((t) => t.value === row.disclosureType)?.label ?? "Figure"}
                    </div>
                    <Kicker className="mt-0.5 tracking-[0.1em]">
                      {row.recipient ? `${shortAddr(row.recipient)} · ` : ""}mgr {shortAddr(row.manager)}
                    </Kicker>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground group-hover:text-foreground">Load →</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-md border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <Kicker>Disclosed figure</Kicker>
          {validManager && meta.symbol && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden />
              {meta.symbol}
              {meta.name ? ` · ${meta.name}` : ""}
            </span>
          )}
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <Label htmlFor="mgr">Vesting manager</Label>
            <Input id="mgr" placeholder="0x…" value={manager} onChange={(e) => setManager(e.target.value.trim())} />
            {manager && !validManager && <p className="text-sm text-destructive">Invalid address.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vid">Vesting id</Label>
            <Input id="vid" placeholder="0x… (32-byte id)" value={vestingId} onChange={(e) => setVestingId(e.target.value.trim())} />
            {vestingId && !validVid && <p className="text-sm text-destructive">Must be a 32-byte hex id.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt">Disclosed figure</Label>
            <Select value={String(dtype)} onValueChange={(v) => setDtype(Number(v) as DisclosureType)}>
              <SelectTrigger id="dt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={String(t.value)}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {validManager && validVid && (
            <div className="flex items-baseline justify-between gap-4 rounded-sm border border-border bg-muted/20 px-4 py-3">
              <Kicker className="tracking-[0.12em]">{typeLabel}</Kicker>
              <Redaction revealed={!!revealedText} loading={revealing} chars={13} align="end" className="font-mono text-lg text-foreground">
                {revealedText}
              </Redaction>
            </div>
          )}

          {!isConnected ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Connect the auditor wallet.</p>
              <ConnectButton />
            </div>
          ) : (
            <Button onClick={onReveal} disabled={!matchedHandle || revealing}>
              {revealing ? "Lifting the veil…" : `Reveal ${typeLabel.toLowerCase()}`}
            </Button>
          )}

          {isConnected && validManager && validVid && !matchedHandle && mine.data && (
            <p className="text-sm text-muted-foreground">
              No figure disclosed to <span className="font-mono text-foreground">{shortAddr(address)}</span> here. You can only
              read a figure the issuer disclosed to your connected wallet.
            </p>
          )}
          {decrypt.error && <p className="text-sm text-destructive">{err(decrypt.error)}</p>}
        </div>
      </div>
    </div>
  )
}
