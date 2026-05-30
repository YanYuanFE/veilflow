import { useState } from "react"
import { isAddress, parseUnits, formatUnits, type Address, type Hex } from "viem"
import { useAccount } from "wagmi"
import { useZamaSDK, useConfidentialApprove, useUserDecrypt } from "@zama-fhe/react-sdk"
import { encryptUint64 } from "@tokenops/sdk/fhe-airdrop"
import {
  useCreateAndFundConfidentialAirdropAndGetAddress,
  useSignClaimAuthorization,
  useClaim,
  useGetClaimAmount,
} from "@tokenops/sdk/fhe-airdrop/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// ERC-7984 confidential tokens use 6 decimals; airdrop factory on Sepolia (auto-resolved by the SDK too).
const DECIMALS = 6
const FACTORY_SEPOLIA = "0xbE6A3B78B36684fFee48De77d47Bc3393F5Acd4c" as Address
const ZERO = "0x0000000000000000000000000000000000000000" as Address

type EncryptedInput = Awaited<ReturnType<typeof encryptUint64>>
type ClaimPayload = { encryptedInput: EncryptedInput; signature: Hex; recipient: Address }

function randomSalt(): Hex {
  const b = crypto.getRandomValues(new Uint8Array(32))
  return ("0x" + Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")) as Hex
}

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function Airdrop() {
  const { address, isConnected } = useAccount()
  const sdk = useZamaSDK()

  const [token, setToken] = useState("")
  const [fund, setFund] = useState("")
  const [airdrop, setAirdrop] = useState<Address>()
  const validToken = isAddress(token)

  const approve = useConfidentialApprove({ tokenAddress: validToken ? (token as Address) : ZERO })
  const create = useCreateAndFundConfidentialAirdropAndGetAddress({ encryptor: () => sdk.relayer })

  const [recipient, setRecipient] = useState("")
  const [allocation, setAllocation] = useState("")
  const [payload, setPayload] = useState<ClaimPayload>()
  const sign = useSignClaimAuthorization()
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState<string>()

  const claim = useClaim({ address: airdrop ?? ZERO })
  const getAmount = useGetClaimAmount({ address: airdrop ?? ZERO })
  const [viewHandle, setViewHandle] = useState<Hex>()
  const decrypt = useUserDecrypt(
    { handles: viewHandle && airdrop ? [{ handle: viewHandle, contractAddress: airdrop }] : [] },
    { enabled: !!viewHandle && !!airdrop },
  )
  const revealed = viewHandle ? decrypt.data?.[viewHandle] : undefined

  const onApprove = () =>
    approve.mutate({ spender: FACTORY_SEPOLIA, until: Math.floor(Date.now() / 1000) + 86_400 })

  const onCreate = async () => {
    if (!validToken || !fund || !address) return
    const now = Math.floor(Date.now() / 1000)
    const res = await create.mutateAsync({
      params: {
        token: token as Address,
        startTimestamp: now,
        endTimestamp: now + 30 * 86_400,
        canExtendClaimWindow: false,
        admin: address,
      },
      userSalt: randomSalt(),
      amount: parseUnits(fund, DECIMALS),
    })
    setAirdrop(res.airdrop)
  }

  const onIssue = async () => {
    setIssueError(undefined)
    if (!airdrop || !isAddress(recipient) || !allocation) return
    setIssuing(true)
    try {
      const encryptedInput = await encryptUint64({
        encryptor: sdk.relayer,
        contractAddress: airdrop,
        userAddress: recipient as Address,
        value: parseUnits(allocation, DECIMALS),
      })
      const signature = await sign.mutateAsync({
        airdropAddress: airdrop,
        recipient: recipient as Address,
        encryptedAmountHandle: encryptedInput.handle,
      })
      setPayload({ encryptedInput, signature, recipient: recipient as Address })
    } catch (e) {
      setIssueError(err(e))
    } finally {
      setIssuing(false)
    }
  }

  const onReveal = async () => {
    if (!payload) return
    const view = await getAmount.mutateAsync({
      encryptedInput: payload.encryptedInput,
      signature: payload.signature,
    })
    setViewHandle(view.handle)
  }

  const onClaim = () =>
    payload && claim.mutate({ encryptedInput: payload.encryptedInput, signature: payload.signature })

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Confidential airdrop</h1>
        <p className="text-muted-foreground">
          Fund a pool with a wrapped (ERC-7984) token, issue EIP-712 signed claims with encrypted
          per-recipient amounts, then reveal &amp; claim. For a single-wallet demo, use your own
          address as the recipient.
        </p>
      </div>

      {/* 1. Create & fund */}
      <Card>
        <CardHeader>
          <CardTitle>1 · Create &amp; fund</CardTitle>
          <CardDescription>Approve the factory as an operator, then deploy and fund the pool.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Confidential token (wrapper) address</Label>
            <Input id="token" placeholder="0x…" value={token} onChange={(e) => setToken(e.target.value.trim())} />
            {token && !validToken && <p className="text-sm text-destructive">Invalid address.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fund">Funding amount</Label>
            <Input id="fund" inputMode="decimal" placeholder="0.0" value={fund} onChange={(e) => setFund(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onApprove} disabled={!isConnected || !validToken || approve.isPending}>
              {approve.isPending ? "Approving…" : approve.isSuccess ? "Operator approved ✓" : "Approve factory"}
            </Button>
            <Button onClick={onCreate} disabled={!isConnected || !validToken || !fund || create.isPending}>
              {create.isPending ? "Creating…" : "Create & fund airdrop"}
            </Button>
          </div>
          {approve.error && <p className="text-sm text-destructive">{err(approve.error)}</p>}
          {create.error && <p className="text-sm text-destructive">{err(create.error)}</p>}
          {airdrop && (
            <div className="rounded-md border p-3 text-sm">
              <span className="text-muted-foreground">Airdrop pool: </span>
              <span className="font-mono break-all">{airdrop}</span>
            </div>
          )}
          {!isConnected && <p className="text-sm text-muted-foreground">Connect your wallet to begin.</p>}
        </CardContent>
      </Card>

      {/* 2. Issue a signed claim */}
      <Card className={airdrop ? "" : "opacity-60"}>
        <CardHeader>
          <CardTitle>2 · Issue a claim (admin)</CardTitle>
          <CardDescription>Encrypt an allocation bound to the recipient and sign the authorization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient address</Label>
            <div className="flex gap-2">
              <Input id="recipient" placeholder="0x…" value={recipient} onChange={(e) => setRecipient(e.target.value.trim())} />
              <Button variant="ghost" type="button" disabled={!address} onClick={() => address && setRecipient(address)}>
                Use mine
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="alloc">Allocation amount</Label>
            <Input id="alloc" inputMode="decimal" placeholder="0.0" value={allocation} onChange={(e) => setAllocation(e.target.value)} />
          </div>
          <Button onClick={onIssue} disabled={!airdrop || !isAddress(recipient) || !allocation || issuing}>
            {issuing ? "Encrypting & signing…" : "Issue signed claim"}
          </Button>
          {issueError && <p className="text-sm text-destructive">{issueError}</p>}
          {payload && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <div className="text-muted-foreground">Claim payload ready for {payload.recipient.slice(0, 6)}…{payload.recipient.slice(-4)}</div>
              <div className="font-mono break-all text-xs">handle: {payload.encryptedInput.handle}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Reveal & claim */}
      <Card className={payload ? "" : "opacity-60"}>
        <CardHeader>
          <CardTitle>3 · Reveal &amp; claim (recipient)</CardTitle>
          <CardDescription>
            The connected wallet must be the recipient (input proof is bound to it). Reveal decrypts your
            amount; Claim transfers the tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onReveal} disabled={!payload || getAmount.isPending}>
              {getAmount.isPending ? "Granting access…" : "Reveal my amount"}
            </Button>
            <Button onClick={onClaim} disabled={!payload || claim.isPending}>
              {claim.isPending ? "Claiming…" : claim.isSuccess ? "Claimed ✓" : "Claim tokens"}
            </Button>
          </div>
          {typeof revealed === "bigint" && (
            <div className="rounded-md border p-3 text-sm">
              <span className="text-muted-foreground">Decrypted allocation: </span>
              <span className="font-mono">{formatUnits(revealed, DECIMALS)}</span>
            </div>
          )}
          {getAmount.error && <p className="text-sm text-destructive">{err(getAmount.error)}</p>}
          {decrypt.error && <p className="text-sm text-destructive">{err(decrypt.error)}</p>}
          {claim.error && <p className="text-sm text-destructive">{err(claim.error)}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
