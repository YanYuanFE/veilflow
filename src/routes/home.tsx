import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function Home() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Confidential token distribution</h1>
        <p className="max-w-2xl text-muted-foreground">
          VeilFlow wraps any ERC-20 into a confidential ERC-7984 token and distributes it —
          airdrops, disperse, and vesting — with amounts encrypted end-to-end. Powered by Zama FHE
          and the TokenOps SDK.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/wrap">Wrap a token</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/airdrop">Create an airdrop</Link>
        </Button>
      </div>
    </div>
  )
}
