import { type ReactNode } from "react"
import { useAccount, useSwitchChain } from "wagmi"
import { sepolia } from "wagmi/chains"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

/** Write ops (the encrypted getters, claims) need the wallet on Sepolia — on any
 *  other network the SDK can't get a walletClient ("walletClient is required for
 *  write operations"). When the wallet is elsewhere, swap the action area for a
 *  one-tap switch instead of letting the call fail. */
export function ChainGate({ children }: { children: ReactNode }) {
  const { isConnected, chainId } = useAccount()
  const { switchChainAsync, isPending } = useSwitchChain()

  if (!isConnected || chainId === sepolia.id) return <>{children}</>

  const onSwitch = () =>
    switchChainAsync({ chainId: sepolia.id }).catch((e) => toast.error(e instanceof Error ? e.message : String(e)))

  return (
    <div className="flex justify-center">
      <Button variant="outline" onClick={onSwitch} disabled={isPending}>
        {isPending ? "Switching…" : "Switch to Sepolia"}
      </Button>
    </div>
  )
}
