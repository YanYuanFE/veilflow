import { useAccount, useConnect, useDisconnect } from "wagmi"
import { Button } from "@/components/ui/button"

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-muted-foreground">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <Button variant="outline" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    )
  }

  const injectedConnector = connectors[0]
  return (
    <Button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  )
}
