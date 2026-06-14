import { useState } from "react"
import { isAddress, parseUnits, parseEther, type Address } from "viem"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import { useZamaSDK } from "@zama-fhe/react-sdk"
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

  const [roleKey, setRoleKey] = useState<RoleKey>("PAUSER_ROLE")
  const [target, setTarget] = useState("")
  const role = rolesQ.data?.[roleKey]
  const validTarget = isAddress(target)
  const hasRoleQ = useHasRole({ address: manager, role, account: validTarget ? (target as Address) : undefined })

  const onGrant = async () => {
    if (!role || !validTarget) return
    try {
      await grant.mutateAsync({ role, accountTarget: target as Address })
      await hasRoleQ.refetch()
      toast.success("Role granted")
    } catch (e) {
      toast.error(err(e))
    }
  }
  const onRevoke = async () => {
    if (!role || !validTarget) return
    try {
      await revoke.mutateAsync({ role, accountTarget: target as Address })
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
      if (feeType === FeeType.DistributionToken) await withdrawTokenFee.mutateAsync({ to: feeRecipient, amount: parseUnits(feeAmount, decimals) })
      else await withdrawGas.mutateAsync({ to: feeRecipient, amount: parseEther(feeAmount) })
      setFeeAmount("")
      toast.success("Fees withdrawn")
    } catch (e) {
      toast.error(err(e))
    }
  }

  const onWithdrawSurplus = async () => {
    if (!surplus) return
    try {
      await withdrawAdmin.mutateAsync({ amount: parseUnits(surplus, decimals) })
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
      if (rescueKind === "confidential") await withdrawOtherConf.mutateAsync({ token: rescueToken as Address, to })
      else await withdrawOther.mutateAsync({ token: rescueToken as Address, to })
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
