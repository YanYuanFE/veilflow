import { useState } from "react"
import { isAddress, parseUnits, formatUnits, type Address } from "viem"
import { useAccount } from "wagmi"
import { useUnshield, useConfidentialBalance } from "@zama-fhe/react-sdk"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ZERO = "0x0000000000000000000000000000000000000000" as Address

export function Unwrap() {
  const { isConnected } = useAccount()
  const [token, setToken] = useState("")
  const [amount, setAmount] = useState("")
  const [reveal, setReveal] = useState(false)

  const valid = isAddress(token)
  const tokenAddress = (valid ? (token as Address) : ZERO)

  // ERC-7984 confidential tokens use 6 decimals by convention.
  const decimals = 6
  const balance = useConfidentialBalance(
    { tokenAddress },
    { enabled: valid && isConnected && reveal },
  )
  const unshield = useUnshield({ tokenAddress })

  const onUnwrap = async () => {
    if (!valid || !amount) return
    await unshield.mutateAsync({ amount: parseUnits(amount, decimals) })
    setAmount("")
    if (reveal) await balance.refetch()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Unwrap</h1>
        <p className="text-muted-foreground">
          Unshield a confidential ERC-7984 token back into its public ERC-20. Runs the unwrap and
          finalize steps for you.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Confidential token</CardTitle>
          <CardDescription>Enter the confidential (ERC-7984 wrapper) token address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token address</Label>
            <Input
              id="token"
              placeholder="0x…"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
            />
            {token && !valid && <p className="text-sm text-destructive">Invalid address.</p>}
          </div>

          {valid && (
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span className="text-muted-foreground">Confidential balance</span>
              {reveal ? (
                <span className="font-mono">
                  {balance.isLoading
                    ? "decrypting…"
                    : balance.data != null
                      ? formatUnits(balance.data, decimals)
                      : "—"}
                </span>
              ) : (
                <Button size="sm" variant="ghost" disabled={!isConnected} onClick={() => setReveal(true)}>
                  Reveal
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to unwrap</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <Button onClick={onUnwrap} disabled={!isConnected || !valid || !amount || unshield.isPending}>
            {unshield.isPending ? "Unwrapping…" : "Unwrap"}
          </Button>
          {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to unwrap.</p>}
          {unshield.error && <p className="text-sm text-destructive">{unshield.error.message}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
