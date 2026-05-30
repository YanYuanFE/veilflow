import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { formatUnits, isAddress, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useUserDecrypt } from "@zama-fhe/react-sdk"
import {
  useManagerToken,
  useGetTotalAllocation,
  useGetVestedAmount,
  useGetSettledAmount,
  useGetClaimableAmount,
} from "@tokenops/sdk/fhe-vesting/react"
import { DisclosureType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTokenMeta } from "@/lib/tokens"

const ZERO = "0x0000000000000000000000000000000000000000" as Address
const VID_RE = /^0x[0-9a-fA-F]{64}$/
const SELECT_CLS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

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
  const { isConnected } = useAccount()

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

  // One getter per disclosure type — call the one matching what was disclosed.
  const total = useGetTotalAllocation({ address: m })
  const vested = useGetVestedAmount({ address: m })
  const settled = useGetSettledAmount({ address: m })
  const claimable = useGetClaimableAmount({ address: m })
  const getter = {
    [DisclosureType.TotalAllocation]: total,
    [DisclosureType.VestedAmount]: vested,
    [DisclosureType.ClaimableAmount]: claimable,
    [DisclosureType.SettledAmount]: settled,
  }[dtype]

  const decrypt = useUserDecrypt(
    { handles: viewHandle && validManager ? [{ handle: viewHandle, contractAddress: m }] : [] },
    { enabled: !!viewHandle && validManager },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined
  const typeLabel = TYPES.find((t) => t.value === dtype)?.label ?? ""

  const onReveal = async () => {
    if (!validManager || !validVid) return
    setViewHandle(undefined)
    const id = vestingId as Hex
    try {
      // Call the getter matching the disclosed figure. Vested is time-dependent → pass "now".
      const view =
        dtype === DisclosureType.VestedAmount
          ? await vested.mutateAsync({ vestingId: id, timestamp: Math.floor(Date.now() / 1000) })
          : dtype === DisclosureType.ClaimableAmount
            ? await claimable.mutateAsync({ vestingId: id })
            : dtype === DisclosureType.SettledAmount
              ? await settled.mutateAsync({ vestingId: id })
              : await total.mutateAsync({ vestingId: id })
      setViewHandle(view.handle)
      toast.success("Access granted — decrypting")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Auditor view</h1>
        <p className="text-muted-foreground">
          View an encrypted vesting figure you were granted read access to. Connect the auditor wallet the issuer
          disclosed to — no one else can decrypt it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disclosed figure</CardTitle>
          <CardDescription>Enter the manager &amp; vesting id the issuer shared with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mgr">Vesting manager address</Label>
            <Input id="mgr" placeholder="0x…" value={manager} onChange={(e) => setManager(e.target.value.trim())} />
            {manager && !validManager && <p className="text-sm text-destructive">Invalid address.</p>}
            {validManager && meta.symbol && (
              <p className="text-xs text-muted-foreground">
                Token: 🔒 {meta.symbol}
                {meta.name ? ` · ${meta.name}` : ""}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vid">Vesting id</Label>
            <Input id="vid" placeholder="0x… (32-byte id)" value={vestingId} onChange={(e) => setVestingId(e.target.value.trim())} />
            {vestingId && !validVid && <p className="text-sm text-destructive">Must be a 32-byte hex id.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="dt">Disclosed figure</Label>
            <select id="dt" className={SELECT_CLS} value={dtype} onChange={(e) => setDtype(Number(e.target.value) as DisclosureType)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {!isConnected ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Connect the auditor wallet.</p>
              <ConnectButton />
            </div>
          ) : (
            <Button onClick={onReveal} disabled={!validManager || !validVid || getter.isPending}>
              {getter.isPending ? "Granting access…" : `Reveal ${typeLabel.toLowerCase()}`}
            </Button>
          )}

          {typeof revealed === "bigint" && (
            <div className="rounded-md border p-3 text-sm">
              <span className="text-muted-foreground">{typeLabel}: </span>
              <span className="font-mono">
                {formatUnits(revealed, decimals)} {meta.symbol ?? ""}
              </span>
            </div>
          )}
          {getter.error && <p className="text-sm text-destructive">{err(getter.error)}</p>}
          {decrypt.error && <p className="text-sm text-destructive">{err(decrypt.error)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
