import { useState } from "react"
import { isAddress, parseUnits, parseEther, formatUnits, type Address, type Hex } from "viem"
import { useAccount, useBalance } from "wagmi"
import { toast } from "sonner"
import { useZamaSDK, useUserDecrypt } from "@zama-fhe/react-sdk"
import {
  useRoleConstants,
  useGrantRole,
  useRevokeRole,
  useHasRole,
  useManagerFeeInfo,
  useWithdrawGasFee,
  useWithdrawTokenFee,
  useWithdrawAdmin,
  useWithdrawOtherToken,
  useWithdrawOtherConfidentialToken,
  useAllRecipients,
  useRecipientVestings,
  useAdminClaim,
  useAdminPartialClaim,
  useAdminGetTotalAllocation,
  useAdminGetVestedAmount,
  useAdminGetClaimableAmount,
  useAdminGetSettledAmount,
  useAdminGetTokenBalance,
} from "@tokenops/sdk/fhe-vesting/react"
import { FeeType } from "@tokenops/sdk/fhe-vesting"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Kicker } from "@/components/editorial"
import { shortAddr } from "@/lib/format"
import { type Distribution } from "@/lib/api"
import { err, numberConfig } from "./shared"
import { useConfirmTx } from "@/lib/use-confirm-tx"

type RoleKey =
  | "DEFAULT_ADMIN_ROLE"
  | "VESTING_CREATOR_ROLE"
  | "REVOKER_ROLE"
  | "WITHDRAWER_ROLE"
  | "CLAIMER_ROLE"
  | "FEE_COLLECTOR_ROLE"
  | "PAUSER_ROLE"
  | "DISCLOSURE_ADMIN_ROLE"

const ROLE_OPTIONS: { key: RoleKey; label: string }[] = [
  { key: "PAUSER_ROLE", label: "Pauser — pause/resume" },
  { key: "REVOKER_ROLE", label: "Revoker — revoke vestings" },
  { key: "WITHDRAWER_ROLE", label: "Withdrawer — withdraw funds" },
  { key: "FEE_COLLECTOR_ROLE", label: "Fee collector — withdraw fees" },
  { key: "DISCLOSURE_ADMIN_ROLE", label: "Disclosure admin — disclose figures" },
  { key: "VESTING_CREATOR_ROLE", label: "Vesting creator — create grants" },
  { key: "CLAIMER_ROLE", label: "Claimer — claim on behalf" },
  { key: "DEFAULT_ADMIN_ROLE", label: "Admin — manage roles" },
]

export function VestingRolesCard({ d }: { d: Distribution }) {
  const manager = d.contractAddress as Address
  const rolesQ = useRoleConstants({ address: manager })
  const grant = useGrantRole({ address: manager })
  const revoke = useRevokeRole({ address: manager })
  const confirm = useConfirmTx()

  const [roleKey, setRoleKey] = useState<RoleKey>("PAUSER_ROLE")
  const [target, setTarget] = useState("")
  const role = rolesQ.data?.[roleKey]
  const validTarget = isAddress(target)
  const hasRoleQ = useHasRole({ address: manager, role, account: validTarget ? (target as Address) : undefined })

  const onGrant = async () => {
    if (!role || !validTarget) return
    try {
      const hash = await grant.mutateAsync({ role, accountTarget: target as Address })
      await confirm(hash)
      await hasRoleQ.refetch()
      toast.success("Role granted")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onRevoke = async () => {
    if (!role || !validTarget) return
    try {
      const hash = await revoke.mutateAsync({ role, accountTarget: target as Address })
      await confirm(hash)
      await hasRoleQ.refetch()
      toast.success("Role revoked")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <CardDescription>
          Delegate manager permissions to other wallets. You need the role's admin (usually the manager admin) to grant
          or revoke.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="role-key">Role</Label>
            <Select value={roleKey} onValueChange={(v) => setRoleKey(v as RoleKey)}>
              <SelectTrigger id="role-key" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-target">Wallet</Label>
            <Input id="role-target" placeholder="0x…" value={target} onChange={(e) => setTarget(e.target.value.trim())} />
          </div>
        </div>
        {validTarget && role && (
          <p className="text-xs text-muted-foreground">
            {shortAddr(target)} {hasRoleQ.data === true ? "holds" : hasRoleQ.data === false ? "does not hold" : "…"} this role.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={onGrant} disabled={!role || !validTarget || grant.isPending}>
            {grant.isPending ? "Granting…" : "Grant role"}
          </Button>
          <Button size="sm" variant="outline" onClick={onRevoke} disabled={!role || !validTarget || revoke.isPending}>
            {revoke.isPending ? "Revoking…" : "Revoke role"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function VestingTreasuryCard({ d }: { d: Distribution }) {
  const sdk = useZamaSDK()
  const { address } = useAccount()
  const manager = d.contractAddress as Address
  const decimals = numberConfig(d, "decimals", 6)

  const feeInfoQ = useManagerFeeInfo({ address: manager })
  const feeType = feeInfoQ.data?.feeType
  const withdrawGas = useWithdrawGasFee({ address: manager })
  const withdrawTokenFee = useWithdrawTokenFee({ address: manager, encryptor: () => sdk.relayer })
  const withdrawAdmin = useWithdrawAdmin({ address: manager, encryptor: () => sdk.relayer })
  const withdrawOtherConf = useWithdrawOtherConfidentialToken({ address: manager })
  const withdrawOther = useWithdrawOtherToken({ address: manager })
  const confirm = useConfirmTx()

  // Withdrawable balances: the gas-fee pool is the manager's ETH (public); the surplus
  // pool is the confidential token balance — revealed on demand like any other figure.
  const ethBalQ = useBalance({ address: manager })
  const getBalance = useAdminGetTokenBalance({ address: manager })
  const [balHandle, setBalHandle] = useState<Hex>()
  const balDecrypt = useUserDecrypt(
    { handles: balHandle ? [{ handle: balHandle, contractAddress: manager }] : [] },
    { enabled: !!balHandle },
  )
  const balRevealed = balHandle ? balDecrypt.data?.[balHandle] : undefined
  const balRevealing = getBalance.isPending || (!!balHandle && balRevealed === undefined && !balDecrypt.error)
  const onRevealBalance = async () => {
    try {
      const r = await getBalance.mutateAsync(undefined)
      setBalHandle(r.handle)
    } catch (e) {
      toast.error(err(e))
    }
  }

  const [feeTo, setFeeTo] = useState("")
  const [feeAmount, setFeeAmount] = useState("")
  const [surplus, setSurplus] = useState("")
  const [rescueToken, setRescueToken] = useState("")
  const [rescueTo, setRescueTo] = useState("")
  const [rescueKind, setRescueKind] = useState<"confidential" | "erc20">("confidential")

  const feeRecipient = (isAddress(feeTo) ? feeTo : address) as Address | undefined

  const onCollectFees = async () => {
    if (!feeRecipient || !feeAmount || feeType === undefined) return
    try {
      const hash =
        feeType === FeeType.DistributionToken
          ? await withdrawTokenFee.mutateAsync({ to: feeRecipient, amount: parseUnits(feeAmount, decimals) })
          : await withdrawGas.mutateAsync({ to: feeRecipient, amount: parseEther(feeAmount) })
      await confirm(hash)
      setFeeAmount("")
      toast.success("Fees withdrawn")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onWithdrawSurplus = async () => {
    if (!surplus) return
    try {
      const hash = await withdrawAdmin.mutateAsync({ amount: parseUnits(surplus, decimals) })
      await confirm(hash)
      setSurplus("")
      toast.success("Surplus withdrawn to your wallet")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onRescue = async () => {
    const to = (isAddress(rescueTo) ? rescueTo : address) as Address | undefined
    if (!isAddress(rescueToken) || !to) return
    try {
      const hash =
        rescueKind === "confidential"
          ? await withdrawOtherConf.mutateAsync({ token: rescueToken as Address, to })
          : await withdrawOther.mutateAsync({ token: rescueToken as Address, to })
      await confirm(hash)
      setRescueToken("")
      toast.success("Tokens rescued")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Treasury</CardTitle>
        <CardDescription>
          Collect fees, withdraw surplus, and rescue stray tokens. Each needs the matching manager role (fee collector /
          withdrawer) — reverts otherwise.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Collect fees */}
        <div className="space-y-2">
          <Kicker className="tracking-[0.12em]">
            Collect fees · {feeType === undefined ? "…" : feeType === FeeType.DistributionToken ? "token" : "gas (ETH)"}
          </Kicker>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1 space-y-2">
              <Label htmlFor="fee-to">To</Label>
              <Input id="fee-to" placeholder={address ? `${shortAddr(address)} (you)` : "0x…"} value={feeTo} onChange={(e) => setFeeTo(e.target.value.trim())} />
            </div>
            <div className="w-32 space-y-2">
              <Label htmlFor="fee-amount">Amount</Label>
              <Input id="fee-amount" inputMode="decimal" placeholder="0.0" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
            </div>
            <Button size="sm" onClick={onCollectFees} disabled={!feeRecipient || !feeAmount || feeType === undefined || withdrawGas.isPending || withdrawTokenFee.isPending}>
              {withdrawGas.isPending || withdrawTokenFee.isPending ? "Withdrawing…" : "Withdraw fees"}
            </Button>
          </div>
          {feeType === FeeType.Gas ? (
            ethBalQ.data && (
              <p className="text-xs text-muted-foreground">
                Collectable ≈{" "}
                <span className="font-mono text-foreground">
                  {Number(ethBalQ.data.formatted).toFixed(5)} {ethBalQ.data.symbol}
                </span>{" "}
                ·{" "}
                <button
                  type="button"
                  className="underline decoration-border underline-offset-2 hover:decoration-foreground"
                  onClick={() => ethBalQ.data && setFeeAmount(ethBalQ.data.formatted)}
                >
                  Max
                </button>
              </p>
            )
          ) : feeType === FeeType.DistributionToken ? (
            <p className="text-xs text-muted-foreground">Token-fee balance is confidential — no on-chain getter to reveal it.</p>
          ) : null}
        </div>

        {/* Withdraw surplus */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Withdraw surplus</Kicker>
          <p className="text-xs text-muted-foreground">Pull unallocated confidential tokens out of the manager to your wallet.</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40 space-y-2">
              <Label htmlFor="surplus">Amount</Label>
              <Input id="surplus" inputMode="decimal" placeholder="0.0" value={surplus} onChange={(e) => setSurplus(e.target.value)} />
            </div>
            <Button size="sm" onClick={onWithdrawSurplus} disabled={!surplus || withdrawAdmin.isPending}>
              {withdrawAdmin.isPending ? "Withdrawing…" : "Withdraw surplus"}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Manager balance ·{" "}
            {typeof balRevealed === "bigint" ? (
              <span className="font-mono text-foreground">{formatUnits(balRevealed, decimals)}</span>
            ) : (
              <button
                type="button"
                onClick={onRevealBalance}
                disabled={balRevealing}
                className="underline decoration-border underline-offset-2 hover:decoration-foreground disabled:opacity-50"
              >
                {balRevealing ? "Revealing…" : "Reveal"}
              </button>
            )}
            {balDecrypt.error && <span className="text-destructive">reveal failed</span>}
          </p>
        </div>

        {/* Rescue stray tokens */}
        <div className="space-y-2 border-t border-border pt-5">
          <Kicker className="tracking-[0.12em]">Rescue stray tokens</Kicker>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rescue-token">Token</Label>
              <Input id="rescue-token" placeholder="0x…" value={rescueToken} onChange={(e) => setRescueToken(e.target.value.trim())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rescue-kind">Kind</Label>
              <Select value={rescueKind} onValueChange={(v) => setRescueKind(v as "confidential" | "erc20")}>
                <SelectTrigger id="rescue-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confidential">Confidential (ERC-7984)</SelectItem>
                  <SelectItem value="erc20">Public ERC-20</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem] flex-1 space-y-2">
              <Label htmlFor="rescue-to">To</Label>
              <Input id="rescue-to" placeholder={address ? `${shortAddr(address)} (you)` : "0x…"} value={rescueTo} onChange={(e) => setRescueTo(e.target.value.trim())} />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onRescue}
              disabled={!isAddress(rescueToken) || withdrawOther.isPending || withdrawOtherConf.isPending}
            >
              {withdrawOther.isPending || withdrawOtherConf.isPending ? "Rescuing…" : "Rescue"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Admin claim-on-behalf — push a recipient's vested tokens to them without their
// signature (treasury sweep / gas-sponsored claim). Needs the manager's CLAIMER_ROLE.
export function VestingClaimerCard({ d, recipient: lockedRecipient }: { d: Distribution; recipient?: Address }) {
  const sdk = useZamaSDK()
  const manager = d.contractAddress as Address
  const decimals = numberConfig(d, "decimals", 6)

  const recipientsQ = useAllRecipients({ address: manager })
  const feeInfo = useManagerFeeInfo({ address: manager })
  const adminClaim = useAdminClaim({ address: manager })
  const adminPartial = useAdminPartialClaim({ address: manager, encryptor: () => sdk.relayer })
  const confirm = useConfirmTx()

  const [recipientState, setRecipient] = useState("")
  const recipient = lockedRecipient ?? recipientState
  const vestingsQ = useRecipientVestings({
    address: manager,
    recipient: isAddress(recipient) ? (recipient as Address) : undefined,
  })
  const ids = vestingsQ.data ?? []
  const [vestingId, setVestingId] = useState("")
  const effectiveId = (vestingId || (ids.length === 1 ? ids[0] : "")) as Hex | ""
  const [amount, setAmount] = useState("")

  const fee = feeInfo.data
  const busy = adminClaim.isPending || adminPartial.isPending

  const onClaim = async () => {
    if (!effectiveId || !fee) return
    const vid = effectiveId
    try {
      if (amount.trim()) {
        const wei = parseUnits(amount.trim(), decimals)
        if (wei <= 0n) return
        const hash = await adminPartial.mutateAsync(
          fee.feeType === FeeType.Gas ? { vestingId: vid, amount: wei, value: fee.fee } : { vestingId: vid, amount: wei },
        )
        await confirm(hash)
      } else {
        const hash = await adminClaim.mutateAsync(
          fee.feeType === FeeType.Gas ? { vestingId: vid, feeType: fee.feeType, value: fee.fee } : { vestingId: vid, feeType: fee.feeType },
        )
        await confirm(hash)
      }
      setAmount("")
      toast.success("Claimed on the recipient's behalf — tokens went to their balance")
    } catch (e) {
      toast.error(err(e))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim on behalf</CardTitle>
        <CardDescription>
          Push a recipient's vested tokens to them without their signature — a treasury sweep / gas-sponsored claim.
          Requires the manager's claimer role. Leave the amount blank to claim everything vested, or enter a partial amount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`grid gap-3 ${lockedRecipient ? "" : "sm:grid-cols-2"}`}>
          {!lockedRecipient && (
            <div className="space-y-2">
              <Label htmlFor="claimer-recipient">Recipient</Label>
              <Select
                value={recipientState || undefined}
                onValueChange={(v) => {
                  setRecipient(v)
                  setVestingId("")
                }}
              >
                <SelectTrigger id="claimer-recipient" className="w-full">
                  <SelectValue placeholder="Select recipient…" />
                </SelectTrigger>
                <SelectContent>
                  {recipientsQ.data?.map((r) => (
                    <SelectItem key={r} value={r}>
                      {shortAddr(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="claimer-amount">Amount</Label>
            <Input
              id="claimer-amount"
              inputMode="decimal"
              placeholder="All vested"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        {ids.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="claimer-vesting">Vesting</Label>
            <Select value={vestingId || undefined} onValueChange={setVestingId}>
              <SelectTrigger id="claimer-vesting" className="w-full">
                <SelectValue placeholder="Select vesting…" />
              </SelectTrigger>
              <SelectContent>
                {ids.map((id) => (
                  <SelectItem key={id} value={id}>
                    {shortAddr(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button onClick={onClaim} disabled={!effectiveId || !fee || busy}>
          {busy ? "Claiming…" : amount.trim() ? "Claim partial on behalf" : "Claim all vested on behalf"}
        </Button>
        {isAddress(recipient) && !vestingsQ.isLoading && ids.length === 0 && (
          <p className="text-xs text-muted-foreground">No vesting found for that recipient.</p>
        )}
      </CardContent>
    </Card>
  )
}

type AdminMetric = "claimable" | "vested" | "settled" | "total" | "balance"
const ADMIN_METRICS: { value: AdminMetric; label: string; needsVesting: boolean }[] = [
  { value: "claimable", label: "Claimable now", needsVesting: true },
  { value: "vested", label: "Vested so far", needsVesting: true },
  { value: "settled", label: "Settled (claimed)", needsVesting: true },
  { value: "total", label: "Total allocation", needsVesting: true },
  { value: "balance", label: "Manager token balance", needsVesting: false },
]

// Admin-side encrypted views — decrypt a recipient's figures (or the manager's own
// balance) with the caller's admin permission. For audits / treasury checks; visible
// only to the caller, nothing is published.
export function VestingAdminViewsCard({ d, recipient: lockedRecipient }: { d: Distribution; recipient?: Address }) {
  const manager = d.contractAddress as Address
  const decimals = numberConfig(d, "decimals", 6)

  const recipientsQ = useAllRecipients({ address: manager })
  const [recipientState, setRecipient] = useState("")
  const recipient = lockedRecipient ?? recipientState
  const vestingsQ = useRecipientVestings({
    address: manager,
    recipient: isAddress(recipient) ? (recipient as Address) : undefined,
  })
  const ids = vestingsQ.data ?? []
  const [vestingId, setVestingId] = useState("")
  const effectiveId = (vestingId || (ids.length === 1 ? ids[0] : "")) as Hex | ""
  const [metric, setMetric] = useState<AdminMetric>("claimable")
  const needsVesting = ADMIN_METRICS.find((m) => m.value === metric)?.needsVesting ?? true

  const getTotal = useAdminGetTotalAllocation({ address: manager })
  const getVested = useAdminGetVestedAmount({ address: manager })
  const getClaimable = useAdminGetClaimableAmount({ address: manager })
  const getSettled = useAdminGetSettledAmount({ address: manager })
  const getBalance = useAdminGetTokenBalance({ address: manager })

  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle ? [{ handle: viewHandle, contractAddress: manager }] : [] },
    { enabled: !!viewHandle },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined
  const pending =
    getTotal.isPending || getVested.isPending || getClaimable.isPending || getSettled.isPending || getBalance.isPending
  const revealing = pending || (!!viewHandle && revealed === undefined && !decrypt.error)

  const onReveal = async () => {
    setViewHandle(undefined)
    try {
      if (metric === "balance") {
        const r = await getBalance.mutateAsync(undefined)
        setViewHandle(r.handle)
        return
      }
      if (!effectiveId) return
      const vid = effectiveId
      const r =
        metric === "total"
          ? await getTotal.mutateAsync({ vestingId: vid })
          : metric === "vested"
            ? await getVested.mutateAsync({ vestingId: vid, timestamp: Math.floor(Date.now() / 1000) })
            : metric === "claimable"
              ? await getClaimable.mutateAsync({ vestingId: vid })
              : await getSettled.mutateAsync({ vestingId: vid })
      setViewHandle(r.handle)
    } catch (e) {
      toast.error(err(e))
    }
  }

  const canReveal = (needsVesting ? !!effectiveId : true) && !revealing

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admin views</CardTitle>
        <CardDescription>
          Decrypt a recipient's confidential figures (or the manager's own token balance) with your admin permission —
          for audits and treasury checks. Visible only to you; nothing is published.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="views-metric">Figure</Label>
            <Select
              value={metric}
              onValueChange={(v) => {
                setMetric(v as AdminMetric)
                setViewHandle(undefined)
              }}
            >
              <SelectTrigger id="views-metric" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_METRICS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsVesting && !lockedRecipient && (
            <div className="space-y-2">
              <Label htmlFor="views-recipient">Recipient</Label>
              <Select
                value={recipientState || undefined}
                onValueChange={(v) => {
                  setRecipient(v)
                  setVestingId("")
                  setViewHandle(undefined)
                }}
              >
                <SelectTrigger id="views-recipient" className="w-full">
                  <SelectValue placeholder="Select recipient…" />
                </SelectTrigger>
                <SelectContent>
                  {recipientsQ.data?.map((r) => (
                    <SelectItem key={r} value={r}>
                      {shortAddr(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {needsVesting && ids.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="views-vesting">Vesting</Label>
            <Select
              value={vestingId || undefined}
              onValueChange={(v) => {
                setVestingId(v)
                setViewHandle(undefined)
              }}
            >
              <SelectTrigger id="views-vesting" className="w-full">
                <SelectValue placeholder="Select vesting…" />
              </SelectTrigger>
              <SelectContent>
                {ids.map((id) => (
                  <SelectItem key={id} value={id}>
                    {shortAddr(id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={onReveal} disabled={!canReveal}>
            {revealing ? "Decrypting…" : "Reveal"}
          </Button>
          <span className="font-mono text-sm text-foreground">
            {typeof revealed === "bigint" ? formatUnits(revealed, decimals) : ""}
          </span>
        </div>
        {decrypt.error && <p className="text-xs text-destructive">{err(decrypt.error)}</p>}
        {needsVesting && isAddress(recipient) && !vestingsQ.isLoading && ids.length === 0 && (
          <p className="text-xs text-muted-foreground">No vesting found for that recipient.</p>
        )}
      </CardContent>
    </Card>
  )
}
