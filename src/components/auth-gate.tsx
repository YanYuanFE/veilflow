import { useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Kicker, Notice } from "@/components/editorial"
import { Loading } from "@/components/spinner"
import { fetchSession } from "@/lib/auth"
import { useEnsureSession } from "@/lib/use-siwe-auth"

function err(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function RequireSiweSession({
  children,
  title = "Sign in required",
  description = "Connect your wallet and sign a SIWE message before opening this private workspace.",
}: {
  children: ReactNode
  title?: string
  description?: string
}) {
  const { address, isConnected } = useAccount()
  const ensureSession = useEnsureSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const sessionQ = useQuery({
    queryKey: ["siwe-session", address],
    queryFn: fetchSession,
    enabled: isConnected && !!address,
    staleTime: 30_000,
  })
  const signedIn = !!address && sessionQ.data === address.toLowerCase()

  const signIn = async () => {
    setError(undefined)
    setBusy(true)
    try {
      await ensureSession()
      await sessionQ.refetch()
      toast.success("Signed in")
    } catch (e) {
      setError(err(e))
      toast.error(err(e))
    } finally {
      setBusy(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
        <Kicker>Wallet required</Kicker>
        <p className="font-display mt-3 text-2xl text-foreground">{title}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="mt-6 flex justify-center">
          <ConnectButton />
        </div>
      </div>
    )
  }

  if (sessionQ.isLoading) return <Loading label="Checking session..." />
  if (signedIn) return <>{children}</>

  return (
    <div className="rounded-md border border-border bg-card px-6 py-16 text-center">
      <Kicker>SIWE required</Kicker>
      <p className="font-display mt-3 text-2xl text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Button className="mt-6" onClick={signIn} disabled={busy}>
        <ShieldCheck />
        {busy ? "Signing in..." : "Sign in with wallet"}
      </Button>
      {sessionQ.error && <Notice tone="void" className="mx-auto mt-4 max-w-md text-left">{err(sessionQ.error)}</Notice>}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  )
}
