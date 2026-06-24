import { useState, useMemo } from "react"
import { Undo2, ClipboardList, BadgeCheck, Split } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { formatUnits, formatEther, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useZamaSDK, useConfidentialApprove } from "@zama-fhe/react-sdk"
import {
  useDisperse,
  usePreflightDisperse,
  useRegister,
  useApproveTokenOnWallets,
  useRecoverFromWallets,
} from "@tokenops/sdk/fhe-disperse/react"
import type { DisperseMode } from "@tokenops/sdk/fhe-disperse"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Kicker, Notice } from "@/components/editorial"
import { BalanceLine } from "@/components/balance-line"
import { RecipientImportPanel } from "@/components/recipient-import-panel"
import { parseEntries } from "@/lib/recipients"
import { patchDistribution, type Distribution } from "@/lib/api"
import { DISPERSE_SINGLETON, EXPLORER, err, numberConfig } from "./shared"
import { useConfirmTx } from "@/lib/use-confirm-tx"

const MODES: { value: DisperseMode; label: string; blurb: string }[] = [
  { value: "direct", label: "Direct", blurb: "Straight from your balance via the singleton operator — gas fee per recipient." },
  { value: "wallet", label: "Wallet", blurb: "Routed through your two subwallets — gas fee per recipient." },
  { value: "wallet-token-fee", label: "Wallet · token fee", blurb: "Through your subwallets; the fee is taken in tokens (BPS), no per-recipient ETH." },
]

function parseMode(v: unknown): DisperseMode {
  return v === "wallet" || v === "wallet-token-fee" ? v : "direct"
}

export function DisperseCard({ d }: { d: Distribution }) {
  const queryClient = useQueryClient()
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const token = d.token as Address
  const decimals = numberConfig(d, "decimals", 6)

  const approve = useConfidentialApprove({ tokenAddress: token })
  const approveWallets = useApproveTokenOnWallets()
  const register = useRegister()
  const recover = useRecoverFromWallets()
  const disperse = useDisperse({ encryptor: () => sdk.relayer })
  const confirm = useConfirmTx()

  const [mode, setMode] = useState<DisperseMode>(parseMode(d.config.mode))
  const [input, setInput] = useState("")
  const [progress, setProgress] = useState<string>()
  const [error, setError] = useState<string>()

  const { entries, errors } = useMemo(() => parseEntries(input, decimals), [input, decimals])
  const done = d.status === "completed"
  const batchTotal = entries.reduce((a, e) => a + e.amount, 0n)
  // Disperse the valid, parsed entries; bad lines are surfaced in `errors` but
  // (like the airdrop/vesting panels) don't block sending the good ones.
  const valid = entries.length > 0

  // Preflight drives the whole pre-send UX: registration, approvals, fee, batch
  // limit, per-recipient checks and a single `ready` green-light.
  const recipients = valid ? entries.map((e) => e.recipient) : undefined
  const amounts = valid ? entries.map((e) => e.amount) : undefined
  const preflightQ = usePreflightDisperse({ user: address, token, recipients, amounts, mode })
  const pf = preflightQ.data

  const isWallet = mode !== "direct"
  const needRegister = isWallet && !!pf && !pf.isUserRegistered
  const needApprove =
    !!pf &&
    (mode === "direct" ? pf.hasApprovedSingleton === false : pf.isUserRegistered && !pf.hasApprovedSubwallets.both)
  const ready = !!pf?.ready

  const onRegister = async () => {
    setError(undefined)
    try {
      setProgress("Registering subwallets…")
      const hash = await register.mutateAsync({ token })
      await confirm(hash)
      await preflightQ.refetch()
      toast.success("Subwallets registered")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  const onApprove = async () => {
    setError(undefined)
    try {
      setProgress("Approving…")
      if (mode === "direct") {
        await approve.mutateAsync({ spender: DISPERSE_SINGLETON, until: Math.floor(Date.now() / 1000) + 86_400 })
      } else {
        const hash = await approveWallets.mutateAsync({ token })
        await confirm(hash)
      }
      await preflightQ.refetch()
      toast.success("Approved")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  const onDisperse = async () => {
    setError(undefined)
    if (!recipients || !amounts) return
    try {
      setProgress(`Dispersing to ${recipients.length}…`)
      const res = await disperse.mutateAsync({ token, mode, recipients, amounts })
      await confirm(res)
      await patchDistribution(d.id, { status: "completed", deployTxHash: res.hash, config: { ...d.config, mode } })
      queryClient.invalidateQueries({ queryKey: ["distribution", d.id] })
      setInput("")
      toast.success(`Dispersed to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`)
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  const onRecover = async () => {
    if (!address) return
    setError(undefined)
    try {
      setProgress("Recovering residuals…")
      const hash = await recover.mutateAsync({ token, to: address })
      await confirm(hash)
      toast.success("Residual tokens recovered to your balance")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setProgress(undefined)
    }
  }

  if (done) {
    const doneIsWallet = parseMode(d.config.mode) !== "direct"
    return (
      <Card>
        <CardHeader>
          <CardTitle>Disperse</CardTitle>
          <CardDescription>This distribution has been sent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Notice>
            <span className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-seal" aria-hidden />
              Dispersed — recipients received tokens into their confidential balance.
            </span>
            {d.deployTxHash && (
              <>
                {" "}
                <a
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                  href={`${EXPLORER}/tx/${d.deployTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View tx
                </a>
              </>
            )}
          </Notice>
          {doneIsWallet && (
            <div className="space-y-2 border-t border-border pt-4">
              <Kicker className="tracking-[0.12em]">Recover residuals</Kicker>
              <p className="text-xs text-muted-foreground">
                Wallet-mode disperses can leave dust in your subwallets — sweep any remainder back to your balance.
              </p>
              <Button variant="outline" size="sm" onClick={onRecover} disabled={!address || !!progress || recover.isPending}>
                <Undo2 />
                {recover.isPending ? "Recovering…" : "Recover to my balance"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disperse</CardTitle>
        <CardDescription>
          Import address + amount rows, pass pre-flight, then send from your confidential balance in one encrypted batch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="disperse-mode">Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as DisperseMode)}>
            <SelectTrigger id="disperse-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{MODES.find((m) => m.value === mode)?.blurb}</p>
        </div>

        <RecipientImportPanel
          value={input}
          onChange={setInput}
          entries={entries}
          errors={errors}
          decimals={decimals}
          walletAddress={address}
          readyCount={entries.length}
          readyLabel="Recipients"
          batchTotal={batchTotal}
          batchLabel="Total send"
          batchDetail={batchTotal > 0n ? `${entries.length} recipient${entries.length === 1 ? "" : "s"} in this batch` : undefined}
        />
        <BalanceLine token={token} decimals={decimals} compareTo={batchTotal} />

        {/* Preflight — registration / approval / fee / batch / blockers, all from one read */}
        {valid && address && (
          <div className="space-y-2 rounded-sm border border-border bg-muted/20 p-3">
            <Kicker className="tracking-[0.12em]">Pre-flight · {MODES.find((m) => m.value === mode)?.label}</Kicker>
            {preflightQ.isLoading && <p className="text-xs text-muted-foreground">Checking on-chain…</p>}
            {preflightQ.error && <p className="text-xs text-destructive">{err(preflightQ.error)}</p>}
            {pf && (
              <>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>
                    Fee ·{" "}
                    <span className="font-mono text-foreground">
                      {mode === "wallet-token-fee"
                        ? `${formatUnits(pf.feeTokenAmount ?? 0n, decimals)} tokens`
                        : `${formatEther(pf.feeEth)} ETH`}
                    </span>
                  </span>
                  <span>
                    Batch · {pf.batchOk ? "within limit" : <span className="text-destructive">over limit ({pf.batchLimit.toString()} max)</span>}
                  </span>
                  {pf.blockers.length > 0 && <span className="text-destructive">{pf.blockers.join("; ")}</span>}
                </div>
                {needRegister && (
                  <Button size="sm" variant="outline" onClick={onRegister} disabled={!!progress || register.isPending}>
                    <ClipboardList />
                    {register.isPending ? "Registering…" : "Register subwallets"}
                  </Button>
                )}
                {!needRegister && needApprove && (
                  <Button size="sm" variant="outline" onClick={onApprove} disabled={!!progress || approve.isPending || approveWallets.isPending}>
                    <BadgeCheck />
                    {mode === "direct" ? "Approve operator" : "Approve token on subwallets"}
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        <Button onClick={onDisperse} disabled={!ready || !!progress}>
          <Split />
          {progress ?? (entries.length ? `Disperse to ${entries.length}` : "Disperse")}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
