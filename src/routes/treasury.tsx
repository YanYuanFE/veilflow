import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { isAddress, parseUnits, formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import {
  useShield,
  useUnshield,
  useResumeUnshield,
  useConfidentialBalance,
  useIsWrapper,
  useConfidentialTokenAddress,
  loadPendingUnshield,
  clearPendingUnshield,
  indexedDBStorage,
} from "@zama-fhe/react-sdk"
import { useTokenDecimals, useUnderlyingToken } from "@/lib/tokens"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Redaction } from "@/components/ui/redaction"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Kicker, Notice } from "@/components/editorial"
import { shortAddr } from "@/lib/format"

const ZERO = "0x0000000000000000000000000000000000000000" as Address

export function Treasury() {
  const { pathname } = useLocation()
  // Deep links decide the opening tab; switching tabs afterwards is local (URL stays put).
  const initialTab = pathname === "/unwrap" ? "unwrap" : "wrap"

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-2">
        <Kicker>Treasury</Kicker>
        <h1 className="font-display text-[clamp(2.5rem,5vw,3.5rem)] leading-tight text-foreground">Wrap &amp; Unwrap</h1>
        <p className="font-sans text-[1.0625rem] leading-relaxed text-muted-foreground">
          Move tokens between their public ERC-20 and confidential ERC-7984 forms — amounts stay encrypted on-chain.
        </p>
      </header>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="wrap">Wrap</TabsTrigger>
          <TabsTrigger value="unwrap">Unwrap</TabsTrigger>
        </TabsList>
        <TabsContent value="wrap">
          <WrapPanel />
        </TabsContent>
        <TabsContent value="unwrap">
          <UnwrapPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WrapPanel() {
  const { isConnected } = useAccount()
  const [token, setToken] = useState("")
  const [amount, setAmount] = useState("")
  const [reveal, setReveal] = useState(false)

  const valid = isAddress(token)
  const tokenAddress = valid ? (token as Address) : ZERO

  // Validate it's actually a confidential ERC-7984 wrapper before touching it —
  // otherwise underlying()/shield revert with a cryptic RPC error.
  const wrapperCheck = useIsWrapper(tokenAddress, { enabled: valid })
  const isWrapper = wrapperCheck.data === true

  // If they pasted a plain ERC-20 by mistake, look up its confidential token in the
  // wrappers registry so we can offer to swap it in — no need to know the wrapper address.
  const discoverFor = valid && wrapperCheck.data === false ? (token as Address) : undefined
  const discovery = useConfidentialTokenAddress({ tokenAddress: discoverFor })
  const discovered = discovery.data?.[0] === true ? discovery.data[1] : undefined

  // Balance is in the confidential token's decimals; the shield deposit is in
  // the underlying ERC-20's decimals (can differ, e.g. WETH 18 → cWETH 6).
  const confidentialDecimals = useTokenDecimals(valid && isWrapper ? tokenAddress : undefined)
  const underlyingToken = useUnderlyingToken(valid && isWrapper ? tokenAddress : undefined)
  const underlyingDecimals = useTokenDecimals(underlyingToken)
  const balance = useConfidentialBalance({ tokenAddress }, { enabled: valid && isWrapper && isConnected && reveal })
  const shield = useShield({ tokenAddress })
  const revealedNum = reveal && balance.data != null && confidentialDecimals !== undefined

  const onWrap = async () => {
    if (!valid || !amount || underlyingDecimals === undefined) return
    try {
      await shield.mutateAsync({ amount: parseUnits(amount, underlyingDecimals) })
      setAmount("")
      toast.success("Wrapped into confidential balance")
      if (reveal) await balance.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-sans text-muted-foreground">
        Shield a public ERC-20 into its confidential ERC-7984 token. Amounts become encrypted on-chain.
      </p>
      <div className="space-y-5 rounded-md border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="wrap-token">Confidential token</Label>
          <Input id="wrap-token" placeholder="0x… (ERC-7984 wrapper)" value={token} onChange={(e) => setToken(e.target.value.trim())} />
          {token && !valid && <p className="text-sm text-destructive">Invalid address.</p>}
          {valid && wrapperCheck.isLoading && <p className="text-xs text-muted-foreground">Checking token…</p>}
          {valid && wrapperCheck.data === false && !discovered && (
            <p className="text-sm text-destructive">
              Not a confidential ERC-7984 wrapper. Paste the confidential token address (e.g. cUSDT 0x4E7B…4491), not the
              underlying ERC-20.
            </p>
          )}
          {valid && wrapperCheck.data === false && discovered && (
            <p className="text-sm text-muted-foreground">
              That's a plain ERC-20. Its confidential token is{" "}
              <button
                type="button"
                className="font-mono underline underline-offset-2 hover:text-foreground"
                onClick={() => setToken(discovered)}
              >
                {shortAddr(discovered)}
              </button>{" "}
              — use it?
            </p>
          )}
          {valid && wrapperCheck.error && <p className="text-sm text-destructive">Couldn't verify token: {wrapperCheck.error.message}</p>}
        </div>

        {valid && isWrapper && (
          <div className="flex items-center justify-between gap-4 rounded-sm border border-border bg-muted/20 px-4 py-3">
            <Kicker className="tracking-[0.12em]">Confidential balance</Kicker>
            <div className="flex items-center gap-3">
              <Redaction
                revealed={!!revealedNum}
                loading={reveal && balance.isLoading}
                chars={9}
                align="end"
                className="font-mono text-foreground"
              >
                {revealedNum ? formatUnits(balance.data!, confidentialDecimals!) : undefined}
              </Redaction>
              {!reveal && (
                <Button size="sm" variant="outline" disabled={!isConnected} onClick={() => setReveal(true)}>
                  Reveal
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="wrap-amount">Amount to wrap</Label>
          <Input id="wrap-amount" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <Button
          onClick={onWrap}
          disabled={!isConnected || !valid || !isWrapper || !amount || underlyingDecimals === undefined || shield.isPending}
        >
          {shield.isPending ? "Wrapping…" : "Wrap"}
        </Button>
        {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to wrap.</p>}
        {shield.error && <p className="text-sm text-destructive">{shield.error.message}</p>}
      </div>
    </div>
  )
}

function UnwrapPanel() {
  const { isConnected } = useAccount()
  const [token, setToken] = useState("")
  const [amount, setAmount] = useState("")
  const [reveal, setReveal] = useState(false)

  const valid = isAddress(token)
  const tokenAddress = valid ? (token as Address) : ZERO

  const wrapperCheck = useIsWrapper(tokenAddress, { enabled: valid })
  const isWrapper = wrapperCheck.data === true

  // Unshield burns confidential tokens, so the amount is in the confidential
  // token's decimals — same units as the balance shown below.
  const decimals = useTokenDecimals(valid && isWrapper ? tokenAddress : undefined)
  const balance = useConfidentialBalance({ tokenAddress }, { enabled: valid && isWrapper && isConnected && reveal })
  const unshield = useUnshield({ tokenAddress })
  const resume = useResumeUnshield({ tokenAddress })
  const [pendingTx, setPendingTx] = useState<Hex | null>(null)
  const revealedNum = reveal && balance.data != null && decimals !== undefined

  // Unshield is two-phase (burn → public-decrypt → finalize). If the second phase
  // never lands (reload / network drop), the SDK parks a pending record keyed by the
  // wrapper — detect it so the user can finish the unwrap instead of losing it.
  useEffect(() => {
    if (!valid || !isWrapper) return
    let active = true
    loadPendingUnshield(indexedDBStorage, tokenAddress)
      .then((tx) => active && setPendingTx(tx))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [valid, isWrapper, tokenAddress])

  const onUnwrap = async () => {
    if (!valid || !amount || decimals === undefined) return
    try {
      await unshield.mutateAsync({ amount: parseUnits(amount, decimals) })
      setAmount("")
      setPendingTx(null)
      toast.success("Unwrapped to public ERC-20")
      if (reveal) await balance.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      // A mid-flow failure may have parked a pending finalize — surface it for resume.
      loadPendingUnshield(indexedDBStorage, tokenAddress)
        .then(setPendingTx)
        .catch(() => {})
    }
  }

  const onResume = async () => {
    if (!pendingTx) return
    try {
      await resume.mutateAsync({ unwrapTxHash: pendingTx })
      await clearPendingUnshield(indexedDBStorage, tokenAddress)
      setPendingTx(null)
      toast.success("Unwrap finalized — public ERC-20 released")
      if (reveal) await balance.refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-sans text-muted-foreground">
        Unshield a confidential ERC-7984 token back into its public ERC-20. Runs the unwrap and finalize steps for you.
      </p>
      <div className="space-y-5 rounded-md border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="unwrap-token">Confidential token</Label>
          <Input
            id="unwrap-token"
            placeholder="0x… (ERC-7984 wrapper)"
            value={token}
            onChange={(e) => {
              setToken(e.target.value.trim())
              setPendingTx(null)
            }}
          />
          {token && !valid && <p className="text-sm text-destructive">Invalid address.</p>}
          {valid && wrapperCheck.isLoading && <p className="text-xs text-muted-foreground">Checking token…</p>}
          {valid && wrapperCheck.data === false && (
            <p className="text-sm text-destructive">
              Not a confidential ERC-7984 wrapper. Paste the confidential token address, not the underlying ERC-20.
            </p>
          )}
          {valid && wrapperCheck.error && <p className="text-sm text-destructive">Couldn't verify token: {wrapperCheck.error.message}</p>}
        </div>

        {valid && isWrapper && pendingTx && (
          <Notice tone="seal" className="space-y-2">
            <p>An earlier unwrap was interrupted before it finalized — finish it to receive your public ERC-20.</p>
            <Button size="sm" variant="outline" onClick={onResume} disabled={resume.isPending}>
              {resume.isPending ? "Finalizing…" : "Resume unwrap"}
            </Button>
          </Notice>
        )}

        {valid && isWrapper && (
          <div className="flex items-center justify-between gap-4 rounded-sm border border-border bg-muted/20 px-4 py-3">
            <Kicker className="tracking-[0.12em]">Confidential balance</Kicker>
            <div className="flex items-center gap-3">
              <Redaction
                revealed={!!revealedNum}
                loading={reveal && balance.isLoading}
                chars={9}
                align="end"
                className="font-mono text-foreground"
              >
                {revealedNum ? formatUnits(balance.data!, decimals!) : undefined}
              </Redaction>
              {!reveal && (
                <Button size="sm" variant="outline" disabled={!isConnected} onClick={() => setReveal(true)}>
                  Reveal
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="unwrap-amount">Amount to unwrap</Label>
          <Input id="unwrap-amount" inputMode="decimal" placeholder="0.0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <Button
          onClick={onUnwrap}
          disabled={!isConnected || !valid || !isWrapper || !amount || decimals === undefined || unshield.isPending}
        >
          {unshield.isPending ? "Unwrapping…" : "Unwrap"}
        </Button>
        {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to unwrap.</p>}
        {unshield.error && <p className="text-sm text-destructive">{unshield.error.message}</p>}
      </div>
    </div>
  )
}
